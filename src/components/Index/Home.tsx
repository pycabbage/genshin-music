import { FaCompactDisc, FaMinus, FaPlus, FaTimes } from 'react-icons/fa'
import { BsMusicPlayerFill } from 'react-icons/bs'
import { APP_NAME, isTwa, IS_MOBILE } from "$/Config"
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTheme } from '$lib/Hooks/useTheme'
import './Home.css'
import { MenuItem } from '$cmp/Miscellaneous/MenuItem'
import { KeyboardProvider } from '$lib/Providers/KeyboardProvider'
import { AppButton } from '$cmp/Inputs/AppButton'
import { VsrgIcon } from '$cmp/icons/VsrgIcon'
import { VsrgComposerIcon } from '$cmp/icons/VsrgComposerIcon'
import { useObservableObject } from '$/lib/Hooks/useObservable'
import { homeStore } from '$stores/HomeStore'

interface HomeProps {
    askForStorage: () => void,
    setDontShowHome: (override: boolean) => void,
    closeWelcomeScreen: () => void,
    hasVisited: boolean,
}

export default function Home({ askForStorage, hasVisited, setDontShowHome, closeWelcomeScreen }: HomeProps) {
    const data = useObservableObject(homeStore.state)
    const [appScale, setAppScale] = useState(100)
    const [currentPage, setCurrentPage] = useState('Unknown')
    const [breakpoint, setBreakpoint] = useState(false)
    const homeClass = data.isInPosition ? "home" : "home home-visible"
    const navigate = useNavigate()
    const [theme] = useTheme()

    useEffect(() => {
        const storedFontScale = JSON.parse(localStorage.getItem(APP_NAME + '-font-size') || '100')
        if (storedFontScale < 75 || storedFontScale > 125) return setAppScale(100)
        setAppScale(storedFontScale)
    }, [])
    useEffect(() => {
        const html = document.querySelector('html')
        if (!html) return
        localStorage.setItem(APP_NAME + '-font-size', `${appScale}`)
        if (appScale === 100) {
            html.style.removeProperty("font-size")
            return
        }
        html.style.fontSize = `${appScale}%`
    }, [appScale])

    useEffect(() => {
        const dispose = history.listen((path) => {
            setCurrentPage(path.pathname.replace('/', ''))
        })
        setCurrentPage(window.location.hash.replace("#/", ""))
        KeyboardProvider.register("Escape", () => {
            if (homeStore.state.visible) {
                homeStore.close()
            }
        }, { id: "home" })
        setBreakpoint(window.innerWidth > 900)
        return () => {
            dispose()
            KeyboardProvider.unregisterById("home")
        }
    }, [history])

    return <div
        className={`${homeClass} ignore_click_outside column`}
        style={{
            ...!data.visible ? { display: 'none' } : {},
            backgroundColor: theme.get('background').fade(0.1).toString()
        }}
    >
        <MenuItem
            className='close-home'
            onClick={homeStore.close}
            ariaLabel='Close home menu'
        >
            <FaTimes size={25} />
        </MenuItem>
        <div className='home-padded column'>

            {(breakpoint || !hasVisited) && <div className='home-top'>
                <div className='home-title'>
                    {APP_NAME} Music Nightly
                </div>
                <div className='home-top-text'>
                    An app where you can create, practice and play songs for {APP_NAME}
                </div>
            </div>
            }

            {!hasVisited && <div className='home-welcome'>
                <div>
                    {!isTwa() && <div className='home-spacing'>
                        To have the webapp fullscreen and better view, please add the website to the home screen
                    </div>}
                    <div className='home-spacing'>
                        <div className="red-text">WARNING</div>:
                        Clearing your browser cache / storage might delete your songs, make sure you make backups
                    </div>

                    {data.hasPersistentStorage ?
                        <div>
                            <div className="red-text">WARNING</div>: {"Click the button below to make sure that your browser won't delete your songs if you lack storage"}
                        </div>
                        : null
                    }
                    <div>
                        <span style={{ marginRight: '0.2rem' }}>
                            We use cookies for analytics, by continuing to use this app, you agree to our use of cookies, learn more
                        </span>
                        <Link
                            to='Privacy'
                            style={{ color: 'var(--primary-text)', textDecoration: "underline" }}
                            onClick={homeStore.close}
                        >
                            here
                        </Link>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="home-accept-storage"
                        onClick={() => {
                            closeWelcomeScreen()
                            askForStorage()
                        }}
                    >
                        Confirm
                    </button>
                </div>

            </div>}
            <div className='home-content'>
                <MainContentElement
                    icon={<FaCompactDisc />}
                    title='Composer'
                    style={{ backgroundColor: theme.layer('primary', 0.15, 0.2).fade(0.15).toString() }}
                    background={`./manifestData/composer.webp`}
                    href='Composer'
                    isCurrent={currentPage === 'Composer'}
                >
                    Create or edit songs with a fully fledged music composer. Also with MIDI.
                </MainContentElement>
                <MainContentElement
                    icon={<BsMusicPlayerFill />}
                    title='Player'
                    style={{ backgroundColor: theme.layer('primary', 0.15, 0.2).fade(0.15).toString() }}
                    background={`./manifestData/main.webp`}
                    href=''
                    isCurrent={currentPage === '' || currentPage === 'Player'}
                >
                    Play, download, record and import songs. Learn a song with approaching circle
                    mode and practice mode.
                </MainContentElement>
            </div>
            <div className='row space-around middle-size-pages-wrapper'>
                <MiddleSizePage
                    Icon={VsrgComposerIcon}
                    current={currentPage === 'VsrgComposer'}
                    href='VsrgComposer'
                >
                    <span style={{ fontSize: '1rem' }} className='row-centered'>
                        Vsrg Composer
                        <span style={{ fontSize: '0.7rem' ,marginLeft: '0.3rem' }}>
                            (beta)
                        </span>
                    </span>

                </MiddleSizePage>

                <MiddleSizePage
                    Icon={VsrgIcon}
                    current={currentPage === 'VsrgPlayer'}
                    href='VsrgPlayer'
                >
                    <span style={{ fontSize: '1rem' }} className='row-centered'>
                        Vsrg Player
                        <span style={{ fontSize: '0.7rem' ,marginLeft: '0.3rem' }}>
                            (beta)
                        </span>
                    </span>
                </MiddleSizePage>
            </div>
            <Separator />
            <div className='page-redirect-wrapper'>
                {!isTwa() &&
                    <PageRedirect href='Donate' current={currentPage === 'Donate'}>
                        Donate
                    </PageRedirect>
                }
                <PageRedirect href='ZenKeyboard' current={currentPage === 'ZenKeyboard'}>
                    Zen Keyboard
                </PageRedirect>
                <PageRedirect href='SheetVisualizer' current={currentPage === 'SheetVisualizer'}>
                    Sheet Visualizer
                </PageRedirect>
                <PageRedirect href='Theme' current={currentPage === 'Theme'}>
                    App Theme
                </PageRedirect>
                <PageRedirect href='Changelog' current={currentPage === 'Changelog'}>
                    Changelog
                </PageRedirect>
                <PageRedirect href='Partners' current={currentPage === 'Partners'}>
                    Partners
                </PageRedirect>
                <PageRedirect href='Help' current={currentPage === 'Help'}>
                    Help
                </PageRedirect>
                <PageRedirect href='Backup' current={currentPage === 'Backup'}>
                    Backup
                </PageRedirect>
                {!IS_MOBILE &&
                    <PageRedirect href='Keybinds' current={currentPage === 'Keybinds'}>
                        Keybinds
                    </PageRedirect>
                }
            </div>

        </div>

        <div className='home-bottom'>
            <div className='home-app-scaling row-centered'>
                <span>
                    App scale
                </span>
                <AppButton
                    className='flex-centered'
                    onClick={() => {
                        const newScale = appScale - 2
                        if (newScale < 75) return
                        setAppScale(newScale)
                    }}
                >
                    <FaMinus />
                </AppButton>
                <AppButton
                    className='flex-centered'
                    style={{ marginRight: '0.5rem' }}
                    onClick={() => {
                        const newScale = appScale + 2
                        if (newScale > 125) return
                        setAppScale(newScale)
                    }}
                >
                    <FaPlus />
                </AppButton>
                {appScale}%
            </div>
            <span style={{ padding: '0 1rem', textAlign: 'center' }}>
                © All rights reserved by {APP_NAME === 'Genshin' ? 'HoYoverse' : 'TGC'}. Other properties belong to their respective owners.
            </span>
            <div className='home-dont-show-again row-centered' onClick={() => setDontShowHome(!data.canShow)}>
                <input type='checkbox' checked={!data.canShow} readOnly />
                <span>
                    Hide on open
                </span>
            </div>
        </div>
    </div>
}

interface MiddleSizePageProps {
    children: React.ReactNode,
    href: string
    current: boolean
    Icon: React.FC<{ className?: string }>
}
function MiddleSizePage({ href, children, Icon, current }: MiddleSizePageProps) {
    return <Link
        to={href}
        onClick={homeStore.close}
        className={`middle-size-page row ${current ? 'current-page' : ''}`}
    >
        <Icon className='middle-size-page-icon' />
        {children}
    </Link>
}


interface PageRedirectProps {
    children: React.ReactNode,
    current: boolean,
    href: string
}
function PageRedirect({ children, current, href }: PageRedirectProps) {
    return <Link onClick={homeStore.close} to={href} className={current ? 'current-page' : ''}>
        {children}
    </Link>
}

interface MainContentElementProps {
    title: string,
    icon: React.ReactNode,
    children: React.ReactNode,
    background: string,
    isCurrent: boolean,
    href: string,
    style?: React.CSSProperties

}
function MainContentElement({ title, icon, children, background, isCurrent, href, style = {} }: MainContentElementProps) {
    return <Link
        className={`home-content-element ${isCurrent ? 'current-page' : ''}`}
        to={href}
        onClick={homeStore.close}
    >
        <div className='home-content-background' style={{ backgroundImage: `url(${background})` }}>
        </div>
        <div className='home-content-main' style={style}>
            <div className='home-content-title'>
                {icon} {title}
            </div>
            <div className='home-content-text'>
                {children}
            </div>
            <div className='home-content-open'>
                <button>
                    OPEN
                </button>
            </div>
        </div>
    </Link>
}

interface SeparatorProps {
    children?: React.ReactNode
}
function Separator({ children }: SeparatorProps) {
    return <div className='home-separator'>
        {children}
    </div>
}