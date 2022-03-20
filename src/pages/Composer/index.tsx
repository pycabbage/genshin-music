import { Component } from 'react'
import { FaPlay, FaPlus, FaPause, FaBars, FaChevronLeft, FaChevronRight, FaTools } from 'react-icons/fa';

import { APP_NAME, AUDIO_CONTEXT, MIDI_STATUS, LAYERS_INDEXES, TEMPO_CHANGERS, PitchesType, TempoChanger, EMPTY_LAYER } from "appConfig"

import AddColumn from 'components/icons/AddColumn';
import RemoveColumn from "components/icons/RemoveColumn"

import MidiImport from "./MidiParser"
import ComposerTools from "./Components/ComposerTools"
import ComposerKeyboard from "./ComposerKeyboard"
import ComposerCanvas from "./Canvas"
import Menu from "./Components/Menu"
import Memoized from 'components/Memoized';
import { asyncConfirm, asyncPrompt } from "components/AsyncPrompts"
import { ComposerSettings, ComposerSettingsDataType, ComposerSettingsType, getMIDISettings, MIDISettings } from "lib/BaseSettings"
import Instrument, { NoteData } from "lib/Instrument"
import { getPitchChanger, delay, formatMs, calculateSongLength } from "lib/Utils/Tools"
import { ComposedSong, SerializedComposedSong } from 'lib/Utils/ComposedSong';
import { Column } from 'lib/Utils/SongClasses';
import AudioRecorder from 'lib/AudioRecorder'
import { DB } from 'Database';
import Analytics from 'lib/Analytics';
import { withRouter } from 'react-router-dom'
import HomeStore from 'stores/HomeStore';
import LoggerStore from 'stores/LoggerStore';
import { AppBackground } from 'components/AppBackground';
import { SerializedSong, Song } from 'lib/Utils/Song';
import { SerializedSongType } from 'types/SongTypes';
import { SettingUpdate, SettingVolumeUpdate } from 'types/SettingsPropriety';
import { InstrumentKeys, LayerIndex, LayerType, NoteNameType, Pages } from 'types/GeneralTypes';
import "./Composer.css"
interface ComposerState {
    layers: [Instrument, Instrument, Instrument, Instrument]
    songs: SerializedSongType[]
    isPlaying: boolean
    song: ComposedSong
    settings: ComposerSettingsDataType
    menuOpen: boolean
    layer: LayerType
    selectedColumns: number[]
    toolsVisible: boolean
    midiVisible: boolean
    isRecordingAudio: boolean
    copiedColumns: Column[]
}
class Composer extends Component<any, ComposerState>{
    state: ComposerState
    reverbNode: ConvolverNode | null
    reverbVolumeNode: GainNode | null
    MIDIAccess: WebMidi.MIDIAccess | null
    currentMidiSource: WebMidi.MIDIInput | null
    broadcastChannel: BroadcastChannel | null
    audioContext: AudioContext | null
    recorder: AudioRecorder
    MIDISettings: typeof MIDISettings
    mounted: boolean
    changes: number
    constructor(props: any) {
        super(props)
        const settings = this.getSettings()
        this.state = {
            layers: [new Instrument(), new Instrument(), new Instrument(), new Instrument()],
            songs: [],
            isPlaying: false,
            song: new ComposedSong("Untitled"),
            settings: settings,
            menuOpen: false,
            layer: 1,
            selectedColumns: [],
            toolsVisible: false,
            midiVisible: false,
            isRecordingAudio: false,
            copiedColumns: []
        }
        this.audioContext = AUDIO_CONTEXT
        this.recorder = new AudioRecorder()
        this.MIDISettings = getMIDISettings()
        this.state.song.bpm = settings.bpm.value
        this.state.song.instruments = [
            settings.layer1.value,
            settings.layer2.value,
            settings.layer3.value,
            settings.layer4.value
        ]
        this.mounted = false
        this.changes = 0
        this.broadcastChannel = null
        this.MIDIAccess = null
        this.currentMidiSource = null
        this.reverbNode = null
        this.reverbVolumeNode = null
    }

    componentDidMount() {
        this.mounted = true
        this.init()
        window.addEventListener("keydown", this.handleKeyboard)
        this.broadcastChannel = window.BroadcastChannel ? new BroadcastChannel(APP_NAME + '_composer') : null
        if (this.broadcastChannel) {
            this.broadcastChannel.onmessage = (event) => {
                if (!this.state.settings.syncTabs.value) return
                if (!['play', 'stop'].includes(event?.data)) return
                this.togglePlay(event.data === 'play')
            }
        }
        if (window.location.hostname !== "localhost") {
            window.addEventListener("beforeunload", this.handleUnload)
        }
    }

    componentWillUnmount() {
        const { state } = this
        const { layers } = state
        this.mounted = false
        //@ts-ignore
        if (this.currentMidiSource) this.currentMidiSource.removeEventListener('midimessage', this.handleMidi)
        if (this.MIDIAccess) this.MIDIAccess.removeEventListener('statechange', this.reloadMidiAccess)
        window.removeEventListener('keydown', this.handleKeyboard)
        this.broadcastChannel?.close?.()
        layers.forEach(instrument => instrument.delete())
        this.reverbNode?.disconnect?.()
        this.reverbVolumeNode?.disconnect?.()
        this.reverbNode = null
        this.reverbVolumeNode = null
        this.audioContext = null
        state.isPlaying = false
        if (window.location.hostname !== "localhost") {
            window.removeEventListener("beforeunload", this.handleUnload)
        }
    }

    init = async () => {
        this.syncSongs()
        const { settings } = this.state
        //TODO if new layer is added
        const promises = [
            this.loadInstrument(settings.layer1.value, 1),
            this.loadInstrument(settings.layer2.value, 2),
            this.loadInstrument(settings.layer3.value, 3),
            this.loadInstrument(settings.layer4.value, 4)
        ]
        if (this.mounted) await Promise.all(promises)
        if (this.mounted) await this.loadReverb()
        if (this.mounted) this.setupAudioDestination(settings.caveMode.value)
        if (this.MIDISettings.enabled) {
            if (navigator.requestMIDIAccess) {
                navigator.requestMIDIAccess().then(this.initMidi, () => {
                    LoggerStore.error('MIDI permission not accepted')
                })
            } else {
                LoggerStore.error('MIDI is not supported on this browser')
            }
        }
    }
    componentDidCatch() {
        LoggerStore.error("There was an error with the Composer, reloading the page...")
        this.props.history.push('Composer')
    }

    handleUnload = (event: BeforeUnloadEvent) => {
        event.preventDefault()
        event.returnValue = ''
    }

    handleAutoSave = () => {
        this.changes++
        if (this.changes > 5 && this.state.settings.autosave.value) {
            if (this.state.song.name !== "Untitled") {
                this.updateSong(this.state.song)
            }

        }
    }
    reloadMidiAccess = () => {
        if (this.MIDIAccess) this.initMidi(this.MIDIAccess)
    }
    initMidi = (e: WebMidi.MIDIAccess) => {
        e.addEventListener('statechange', this.reloadMidiAccess)
        this.MIDIAccess = e
        const midiInputs = this.MIDIAccess.inputs.values()
        const inputs = []
        for (let input = midiInputs.next(); input && !input.done; input = midiInputs.next()) {
            inputs.push(input.value)
        }
        //@ts-ignore
        if (this.currentMidiSource) this.currentMidiSource.removeEventListener('midimessage', this.handleMidi)
        this.currentMidiSource = inputs.find(input => {
            return input.name + " " + input.manufacturer === this.MIDISettings.currentSource
        }) || null
        if (this.currentMidiSource) this.currentMidiSource.addEventListener('midimessage', this.handleMidi)

    }
    get currentInstrument() {
        return this.state.layers[this.state.layer - 1]
    }
    handleMidi = (e: WebMidi.MIDIMessageEvent) => {
        if (!this.mounted) return
        const { song, layer } = this.state
        const { data } = e
        const eventType = data[0]
        const note = data[1]
        const velocity = data[2]
        if (MIDI_STATUS.down === eventType && velocity !== 0) {
            const keyboardNotes = this.MIDISettings.notes.filter(e => e.midi === note)
            keyboardNotes.forEach(keyboardNote => {
                this.handleClick(this.currentInstrument.layout[keyboardNote.index])
            })
            const shortcut = this.MIDISettings.shortcuts.find(e => e.midi === note)
            if (!shortcut) return
            switch (shortcut.type) {
                case 'toggle_play': this.togglePlay(); break;
                case 'next_column': this.selectColumn(song.selected + 1); break;
                case 'previous_column': this.selectColumn(song.selected - 1); break;
                case 'add_column': this.addColumns(1, song.selected); break;
                case 'remove_column': this.removeColumns(1, song.selected); break;
                case 'change_layer': {
                    let nextLayer = layer + 1
                    if (nextLayer > LAYERS_INDEXES.length) nextLayer = 1
                    this.changeLayer(nextLayer as LayerType)
                    break;
                }
                default: break;
            }
        }
    }
    loadReverb(): Promise<void> {
        return new Promise(resolve => {
            fetch("./assets/audio/reverb4.wav")
                .then(r => r.arrayBuffer())
                .then(b => {
                    if (!this.mounted) return
                    if (this.audioContext) {
                        this.audioContext.decodeAudioData(b, (impulse_response) => {
                            if (!this.mounted || !this.audioContext) return
                            const convolver = this.audioContext.createConvolver()
                            const gainNode = this.audioContext.createGain()
                            gainNode.gain.value = 2.5
                            convolver.buffer = impulse_response
                            convolver.connect(gainNode)
                            gainNode.connect(this.audioContext.destination)
                            this.reverbNode = convolver
                            this.reverbVolumeNode = gainNode
                            resolve()
                        })
                    }
                }).catch((e) => {
                    console.log("Error with reverb", e)
                })
        })
    }
    getSettings = (): ComposerSettingsDataType => {
        const json = localStorage.getItem(APP_NAME + "_Composer_Settings")
        try {
            const storedSettings = JSON.parse(json || 'null') as ComposerSettingsType | null
            if (storedSettings) {
                if (storedSettings.other?.settingVersion !== ComposerSettings.other.settingVersion) {
                    this.updateSettings(ComposerSettings.data)
                    return ComposerSettings.data
                }
                return storedSettings.data
            }
            return ComposerSettings.data
        } catch (e) {
            return ComposerSettings.data
        }
    }

    updateSettings = (override?: ComposerSettingsDataType) => {
        const state = {
            other: ComposerSettings.other,
            data: override !== undefined ? override : this.state.settings
        }
        localStorage.setItem(APP_NAME + "_Composer_Settings", JSON.stringify(state))
    }

    handleSettingChange = ({ data, key }: SettingUpdate) => {
        const { song, settings } = this.state
        //@ts-ignore
        settings[key] = { ...settings[key], value: data.value }
        if (data.songSetting) {
            //@ts-ignore
            song[key] = data.value
        }
        //TODO if new layer is added
        if (key === "layer1") this.loadInstrument(data.value as InstrumentKeys, 1)
        if (key === "layer2") this.loadInstrument(data.value as InstrumentKeys, 2)
        if (key === "layer3") this.loadInstrument(data.value as InstrumentKeys, 3)
        if (key === "layer4") this.loadInstrument(data.value as InstrumentKeys, 4)
        if (key === "caveMode") this.setupAudioDestination(data.value as boolean)
        this.setState({ settings, song }, this.updateSettings)
    }
    loadInstrument = async (name: InstrumentKeys, layer: LayerType) => {
        if (!this.mounted) return
        const { settings, layers } = this.state
        const instrument = new Instrument(name)
        layers[layer - 1].delete()
        layers[layer - 1] = instrument
        await instrument.load()
        if (!this.mounted) return
        instrument.changeVolume(settings[`layer${layer}`]?.volume)
        this.setState({ layers })
        this.setupAudioDestination(settings.caveMode.value)
    }
    changeVolume = (obj: SettingVolumeUpdate) => {
        const settings = this.state.settings
        const layer = Number(obj.key.split("layer")[1]) - 1 
        //@ts-ignore
        settings[obj.key] = { ...settings[obj.key], volume: obj.value }
        this.state.layers[layer].changeVolume(obj.value)
        this.setState({ settings }, this.updateSettings)
    }
    setupAudioDestination = (hasReverb: boolean) => {
        if (!this.mounted) return
        const { layers } = this.state
        layers.forEach(ins => {
            if (hasReverb) {
                if (!this.reverbNode) return console.log("Couldn't connect to reverb")
                ins.disconnect()
                ins.connect(this.reverbNode)
            } else {
                ins.disconnect()
                if (this.audioContext) ins.connect(this.audioContext.destination)
            }
        })
    }
    startRecordingAudio = async (override?: boolean) => { //will record untill the song stops
        if (!this.mounted) return
        if (!override) {
            this.setState({ isRecordingAudio: false })
            return this.togglePlay(false)
        }
        const { layers } = this.state
        const hasReverb = this.state.settings.caveMode.value
        const { recorder } = this
        if (hasReverb) {
            if (this.reverbVolumeNode) this.reverbVolumeNode.connect(recorder.node)
        } else {
            layers.forEach(instrument => {
                instrument.connect(recorder.node)
            })
        }
        recorder.start()
        this.setState({ isRecordingAudio: true })
        await this.togglePlay(true) //wait till song finishes
        if (!this.mounted) return
        const recording = await recorder.stop()
        this.setState({ isRecordingAudio: false })
        const fileName = await asyncPrompt("Write the song name, press cancel to ignore")
        if (fileName) recorder.download(recording.data, fileName + '.wav')
        if (!this.mounted) return
        if (this.reverbVolumeNode && this.audioContext) {
            this.reverbVolumeNode.disconnect()
            this.reverbVolumeNode.connect(this.audioContext.destination)
        }
        this.setupAudioDestination(hasReverb)
    }
    handleKeyboard = (event: KeyboardEvent) => {
        //@ts-ignore
        if (document.activeElement.tagName === "INPUT") return
        const { layer, layers, isPlaying, song, settings } = this.state
        const key = event.code
        const shouldEditKeyboard = isPlaying || event.shiftKey
        if (shouldEditKeyboard) {
            const letter = key?.replace("Key", "")
            const note = this.currentInstrument.getNoteFromCode(letter)
            if (note !== null) this.handleClick(this.currentInstrument.layout[note])
            switch (key) {
                case "Space": {
                    this.togglePlay()
                    if (!settings.syncTabs.value) break;
                    this.broadcastChannel?.postMessage?.("stop")
                    break;
                }
                default: break;
            }
        } else {
            switch (key) {
                case "KeyD": this.selectColumn(song.selected + 1); break;
                case "KeyA": this.selectColumn(song.selected - 1); break;
                case "Digit1": this.handleTempoChanger(TEMPO_CHANGERS[0]); break;
                case "Digit2": this.handleTempoChanger(TEMPO_CHANGERS[1]); break;
                case "Digit3": this.handleTempoChanger(TEMPO_CHANGERS[2]); break;
                case "Digit4": this.handleTempoChanger(TEMPO_CHANGERS[3]); break;
                case "Space": {
                    this.togglePlay()
                    if (!settings.syncTabs.value) break;
                    this.broadcastChannel?.postMessage?.("play")
                    break;
                }
                case "ArrowUp": {
                    const nextLayer = layer - 1
                    if (nextLayer > 0) this.changeLayer(nextLayer as LayerType)
                    break;
                }
                case "ArrowDown": {
                    const nextLayer = layer + 1
                    if (nextLayer < layers.length + 1) this.changeLayer(nextLayer as LayerType)
                    break;
                }
                case "KeyQ": this.removeColumns(1, song.selected); break;
                case "KeyE": this.addColumns(1, song.selected); break;
                default: break;
            }
        }

    }
    playSound = (instrument: Instrument, index: number) => {
        try {
            const note = instrument.layout[index]
            if (note === undefined) return
            instrument.play(note.index, getPitchChanger(this.state.settings.pitch.value as PitchesType))
        } catch (e) {
        }
    }
    changePitch = (value: PitchesType) => {
        const { settings } = this.state
        settings.pitch = { ...settings.pitch, value }
        this.setState({ settings }, this.updateSettings)
    }
    handleClick = (note: NoteData) => {
        const { layers, song, layer } = this.state
        const column = song.selectedColumn
        const index = column.getNoteIndex(note.index)
        const layerIndex = layer - 1 as LayerIndex
        if (index === null) { //if it doesn't exist, create a new one
            const columnNote = column.addNote(note.index)
            columnNote.setLayer(layerIndex, '1')
        } else { //if it exists, toggle the current layer and if it's 000 delete it
            const currentNote = column.notes[index]
            currentNote.toggleLayer(layerIndex)
            if (currentNote.layer === EMPTY_LAYER) column.removeAtIndex(index)
        }
        this.setState({ song })
        this.handleAutoSave()
        this.playSound(
            layers[layerIndex],
            note.index
        )
    }
    syncSongs = async () => {
        const songs = await DB.getSongs()
        if (!this.mounted) return
        this.setState({ songs })
    }
    addSong = async (song: ComposedSong) => {
        if (await this.songExists(song.name)) {
            LoggerStore.warn("A song with this name already exists! \n" + song.name)
        }
        await DB.addSong(song.serialize())
        this.syncSongs()
    }
    updateSong = async (song: ComposedSong): Promise<void> => {
        if (song.name === "Untitled") {
            let name = await this.askForSongName()
            if (name === null || !this.mounted) return
            song.name = name
            this.changes = 0
            return this.addSong(song)
        }
        return new Promise(async resolve => {
            let settings = this.state.settings
            if (await this.songExists(song.name)) {
                song.instruments[0] = settings.layer1.value
                song.instruments[1] = settings.layer2.value
                song.instruments[2] = settings.layer3.value
                song.instruments[3] = settings.layer4.value
                await DB.updateSong({ name: song.name }, song.serialize())
                console.log("song saved:", song.name)
                this.changes = 0
                this.syncSongs()
            } else {
                if (song.name.includes("- Composed")) {
                    let name = await this.askForSongName("Write composed song name, press cancel to ignore")
                    if (name === null) return resolve()
                    song.name = name
                    await DB.addSong(song.serialize())
                    this.syncSongs()
                    return resolve()
                }
                console.log("song doesn't exist")
                song.name = "Untitled"
                this.updateSong(song)
            }
            resolve()
        })
    }
    askForSongName = (question?: string): Promise<string | null> => {
        return new Promise(async resolve => {
            let promptString = question || "Write song name, press cancel to ignore"
            while (true) {
                const songName = await asyncPrompt(promptString)
                if (songName === null) return resolve(null)
                if (songName !== "") {
                    if (await this.songExists(songName)) {
                        promptString = "This song already exists: " + songName
                    } else {
                        return resolve(songName)
                    }
                } else {
                    promptString = question || "Write song name, press cancel to ignore"
                }
            }
        })

    }
    askForSongUpdate = async () => {
        return await asyncConfirm(`You have unsaved changes to the song: "${this.state.song.name}" do you want to save now?`)
    }
    songExists = async (name: string) => {
        return await DB.existsSong({ name: name })
    }
    createNewSong = async () => {
        if (this.state.song.name !== "Untitled" && this.changes > 0) {
            if (await this.askForSongUpdate()) {
                await this.updateSong(this.state.song)
            }
        }
        const name = await this.askForSongName("Write new song name, press cancel to ignore")
        if (name === null) return
        const song = new ComposedSong(name)
        this.changes = 0
        if (!this.mounted) return
        this.setState({ song }, () => this.addSong(song))
        Analytics.songEvent({ type: 'create' })
    }
    removeSong = async (name: string) => {
        const confirm = await asyncConfirm("Are you sure you want to delete the song: " + name)
        if (confirm) await DB.removeSong({ name: name })
        this.syncSongs()
        Analytics.userSongs('delete', { name: name, page: 'composer' })
    }

    loadSong = async (song: SerializedSongType | ComposedSong) => {
        const state = this.state
        const parsed = song instanceof ComposedSong
            ? song.clone()
            : song.data.isComposedVersion
                ? ComposedSong.deserialize(song as SerializedComposedSong)
                : Song.deserialize(song as SerializedSong).toComposed(4)
        if (!parsed.data.isComposedVersion) {
            parsed.name += " - Composed"
        }
        if (this.changes !== 0) {
            let confirm = state.settings.autosave.value && state.song.name !== "Untitled"
            if (!confirm && state.song.columns.length > 0) {
                confirm = await asyncConfirm(`You have unsaved changes to the song: "${state.song.name}" do you want to save? UNSAVED CHANGES WILL BE LOST`)
            }
            if (confirm) await this.updateSong(state.song)
        }
        const settings = this.state.settings
        settings.bpm = { ...settings.bpm, value: song.bpm }
        settings.pitch = { ...settings.pitch, value: song.pitch }
        if (!this.mounted) return
        const layers = parsed.instruments
        layers.forEach((layer, i) => {
            //@ts-ignore
            if (settings[`layer${i + 1}`].value !== layer) {
                //@ts-ignore
                this.loadInstrument(parsed.instruments[i], i+1)
                //@ts-ignore
                settings[`layer${i + 1}`] = { ...settings[`layer${i + 1}`], value: layer }
            }
        })
        this.changes = 0
        console.log("song loaded")
        this.setState({
            song: parsed,
            settings,
            selectedColumns: []
        })
    }

    addColumns = (amount = 1, position: number | 'end' = "end"): Promise<void> => {
        return new Promise(resolve => {
            const { song } = this.state
            song.addColumns(amount, position)
            if (amount === 1) this.selectColumn(song.selected + 1)
            this.handleAutoSave()
            this.setState({ song }, resolve)
        })
    }

    removeColumns = (amount: number, position: number) => {
        const { song } = this.state
        song.removeColumns(amount, position)
        if (song.columns.length <= song.selected) this.selectColumn(song.selected - 1)
        this.handleAutoSave()
        this.setState({ song })
    }

    togglePlay = async (override?: boolean): Promise<void> => {
        return new Promise(resolve => {
            const newState = typeof override === "boolean" ? override : !this.state.isPlaying
            this.setState({
                isPlaying: newState
            }, async () => {
                if (this.state.isPlaying) this.selectColumn(this.state.song.selected)
                let pastError = 0
                let previousTime = new Date().getTime()
                while (this.state.isPlaying) {
                    const { song, settings } = this.state
                    const tempoChanger = song.selectedColumn.getTempoChanger().changer
                    const msPerBPM = Math.floor(60000 / settings.bpm.value * tempoChanger) + pastError
                    previousTime = new Date().getTime()
                    await delay(msPerBPM)
                    if (!this.state.isPlaying || !this.mounted) break
                    this.handleTick()
                    pastError = previousTime + msPerBPM - new Date().getTime()
                }
                resolve()
            })
        })
    }


    handleTick = () => {
        const newIndex = this.state.song.selected + 1
        if (this.state.isPlaying && newIndex > this.state.song.columns.length - 1) {
            return this.togglePlay(false)
        }
        this.selectColumn(newIndex)
    }
    toggleMenuVisible = () => {
        this.setState({ menuOpen: !this.state.menuOpen })
    }
    toggleBreakpoint = (override?: number) => {
        const { song } = this.state
        song.toggleBreakpoint(override)
        this.validateBreakpoints()
        this.setState({ song })
    }
    handleTempoChanger = (changer: TempoChanger) => {
        const { song } = this.state
        song.selectedColumn.setTempoChanger(changer)
        this.handleAutoSave()
        this.setState({ song })
    }
    changePage = async (page: Pages | 'Home') => {
        const { song, settings } = this.state
        if (this.changes !== 0) {
            if (settings.autosave.value) {
                await this.updateSong(song)
            } else {
                const confirm = await asyncConfirm(`You have unsaved changes to the song: "${song.name}" do you want to save? UNSAVED CHANGES WILL BE LOST`, false)
                if (confirm) {
                    await this.updateSong(song)
                }
            }
        }
        if (page === 'Home') return HomeStore.open()
        //@ts-ignore
        this.props.history.push(page)
    }
    selectColumn = (index: number, ignoreAudio?: boolean) => {
        const { song, toolsVisible, layers, copiedColumns } = this.state
        let selectedColumns = this.state.selectedColumns
        if (index < 0 || index > song.columns.length - 1) return
        song.selected = index
        if (toolsVisible && copiedColumns.length === 0) {
            selectedColumns.push(index)
            const min = Math.min(...selectedColumns)
            const max = Math.max(...selectedColumns)
            selectedColumns = new Array(max - min + 1).fill(0).map((e, i) => min + i)
        }
        this.setState({ song, selectedColumns })
        if (ignoreAudio) return
        song.selectedColumn.notes.forEach(note => {
            layers.forEach((layer,i) => {
                if(note.isLayerToggled(i as LayerIndex)) this.playSound(layer, note.index)
            })
        })
    }
    changeLayer = (layer: LayerType) => {
        this.setState({ layer })
    }
    //-----------------------TOOLS---------------------//
    toggleTools = () => {
        this.setState({
            toolsVisible: !this.state.toolsVisible,
            selectedColumns: this.state.toolsVisible ? [] : [this.state.song.selected],
            copiedColumns: []
        })
    }
    resetSelection = () => {
        this.setState({ copiedColumns: [], selectedColumns: [this.state.song.selected] })
    }
    copyColumns = (layer: LayerType | 'all') => {
        const { selectedColumns, song } = this.state
        const copiedColumns = song.copyColumns(selectedColumns, layer)
        this.changes++
        this.setState({ selectedColumns: [], copiedColumns })
    }
    pasteColumns = async (insert: boolean) => {
        const { song, copiedColumns } = this.state
        song.pasteColumns(copiedColumns, insert)
        this.changes++
        this.setState({ song })
    }
    eraseColumns = (layer: LayerType | 'all') => {
        const { song, selectedColumns } = this.state
        song.eraseColumns(selectedColumns, layer)
        this.changes++
        this.setState({ song, selectedColumns: [song.selected] })
    }
    validateBreakpoints = () => {
        const { song } = this.state
        song.validateBreakpoints()
        this.setState({ song })
    }
    deleteColumns = async () => {
        const { song, selectedColumns } = this.state
        song.deleteColumns(selectedColumns)
        this.changes++
        this.setState({
            song,
            selectedColumns: [song.selected]
        }, this.validateBreakpoints)
    }
    changeMidiVisibility = (visible: boolean) => {
        this.setState({ midiVisible: visible })
        if (visible) Analytics.songEvent({ type: 'create_MIDI' })
    }
    render() {

        const { state } = this
        const { midiVisible, song, isPlaying, copiedColumns } = state
        //TODO export the menu outside this component so it doesnt get re rendered at every change
        const songLength = calculateSongLength(song.columns, state.settings.bpm.value, song.selected)
        const menuData = {
            songs: state.songs,
            currentSong: state.song,
            settings: state.settings,
            hasChanges: this.changes > 0,
            menuOpen: state.menuOpen,
            isRecordingAudio: state.isRecordingAudio
        }
        const menuFunctions = {
            loadSong: this.loadSong,
            removeSong: this.removeSong,
            createNewSong: this.createNewSong,
            changePage: this.changePage,
            updateSong: this.updateSong,
            handleSettingChange: this.handleSettingChange,
            toggleMenuVisible: this.toggleMenuVisible,
            changeVolume: this.changeVolume,
            changeMidiVisibility: this.changeMidiVisibility,
            startRecordingAudio: this.startRecordingAudio
        }
        const keyboardFunctions = {
            handleClick: this.handleClick,
            handleTempoChanger: this.handleTempoChanger,
            changeLayer: this.changeLayer
        }
        const keyboardData = {
            keyboard: state.layers[0],
            currentColumn: state.song.columns[state.song.selected],
            layer: state.layer,
            pitch: state.settings.pitch.value as PitchesType,
            isPlaying: state.isPlaying,
            noteNameType: state.settings.noteNameType.value as NoteNameType,
        }
        const canvasFunctions = {
            selectColumn: this.selectColumn,
            toggleBreakpoint: this.toggleBreakpoint
        }
        const canvasData = {
            columns: song.columns,
            selected: song.selected,
            settings: state.settings,
            breakpoints: state.song.breakpoints,
            selectedColumns: state.selectedColumns
        }
        const toolsData = {
            visible: this.state.toolsVisible,
            hasCopiedColumns: copiedColumns.length > 0,
            layer: this.state.layer
        }
        const toolsFunctions = {
            toggleTools: this.toggleTools,
            eraseColumns: this.eraseColumns,
            deleteColumns: this.deleteColumns,
            copyColumns: this.copyColumns,
            pasteColumns: this.pasteColumns,
            resetSelection: this.resetSelection
        }
        return <AppBackground page='Composer'>
            {midiVisible &&
                <MidiImport
                    functions={{
                        loadSong: this.loadSong,
                        changeMidiVisibility: this.changeMidiVisibility,
                        changePitch: this.changePitch,
                    }}
                    data={{
                        instruments: state.layers
                            .map(layer => layer.instrumentName) as [InstrumentKeys, InstrumentKeys, InstrumentKeys, InstrumentKeys],
                        selectedColumn: song.selected,
                    }}
                />
            }
            <div className="hamburger" onClick={this.toggleMenuVisible}>
                <Memoized>
                    <FaBars />
                </Memoized>
            </div>
            <div className="right-panel-composer">
                <div className="column fill-x">
                    <div className="top-panel-composer">
                        <div className="buttons-composer-wrapper">
                            <div className="tool" onPointerDown={() => this.selectColumn(song.selected + 1)}>
                                <Memoized>
                                    <FaChevronRight />
                                </Memoized>
                            </div>
                            <div className="tool" onClick={() => this.selectColumn(song.selected - 1)}>
                                <Memoized>
                                    <FaChevronLeft />
                                </Memoized>
                            </div>

                            <div className="tool" onClick={() => {
                                this.togglePlay()
                                if (this.state.settings.syncTabs.value) {
                                    this.broadcastChannel?.postMessage?.(isPlaying ? 'stop' : 'play')
                                }
                            }}>
                                <Memoized>
                                    {this.state.isPlaying
                                        ? <FaPause key='pause' />
                                        : <FaPlay key='play' />
                                    }
                                </Memoized>
                            </div>
                        </div>
                        <ComposerCanvas
                            key={this.state.settings.columnsPerCanvas.value}
                            functions={canvasFunctions}
                            data={canvasData}
                        />
                        <div className="buttons-composer-wrapper-right">
                            <div className="tool" onClick={() => this.addColumns(1, song.selected)}>
                                <AddColumn className="tool-icon" />
                            </div>
                            <div className="tool" onClick={() => this.removeColumns(1, song.selected)}>
                                <RemoveColumn className='tool-icon' />
                            </div>
                            <div className="tool" onClick={() => this.addColumns(Number(this.state.settings.beatMarks.value) * 4, "end")}>
                                <Memoized>
                                    <FaPlus />
                                </Memoized>
                            </div>
                            <div className="tool" onClick={this.toggleTools}>
                                <Memoized>
                                    <FaTools />
                                </Memoized>
                            </div>

                        </div>
                    </div>
                </div>
                <ComposerKeyboard
                    functions={keyboardFunctions}
                    data={keyboardData}
                />
            </div>
            <Menu
                data={menuData}
                functions={menuFunctions}
            />
            <ComposerTools
                data={toolsData}
                functions={toolsFunctions}
            />
            <div className="song-info">
                <div>
                    {song.name}
                </div>
                <div>
                    {formatMs(songLength.current)}
                    /
                    {formatMs(songLength.total)}
                </div>
            </div>
        </AppBackground>
    }
}

//@ts-ignore
export default withRouter(Composer)

