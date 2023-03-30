import { HashRouter, Route } from "react-router-dom";
import App from '$pages/App';
import Player from '$pages/Player';
import Composer from "$pages/Composer"
import ErrorPage from "$pages/ErrorPage"
import Changelogpage from '$pages/Changelog'
import Partners from '$pages/Partners';
import Help from '$pages/Help';
import SheetVisualizer from '$pages/SheetVisualizer';
import MidiSetup from '$pages/MidiSetup';
import Donate from '$pages/Donate'
import Error404 from '$pages/404';
import Theme from '$pages/Theme'
import VsrgPlayer from "$pages/VsrgPlayer";
import VsrgComposer from "$pages/VsrgComposer";
import { ThemeProviderWrapper } from '$cmp/ProviderWrappers/ThemeProviderWrapper';
import { AppBackground } from "$cmp/Layout/AppBackground";
import { useEffect } from "react";
import { DropZoneProviderWrapper } from "$cmp/ProviderWrappers/DropZoneProviderWrapper";
import Privacy from "$pages/Privacy";
import ErrorBoundaryRedirect from "$cmp/Utility/ErrorBoundaryRedirect";
import { logger } from "$stores/LoggerStore"
import { Keybinds } from "$pages/Keybinds";
import { ZenKeyboard } from "./pages/ZenKeyboard";
import { Backup } from "./pages/Backup";
import { GeneralProvidersWrapper } from "./components/ProviderWrappers/GeneralProvidersWrapper";
export function Router() {
	useEffect(() => {
		try {
			if ('virtualKeyboard' in navigator) {
				//@ts-ignore
				navigator.virtualKeyboard.overlaysContent = true;
				console.log("virtual keyboard supported")
			} else {
				console.log("virtual keyboard not supported")
			}
		} catch (e) {
			console.error(e)
		}
	}, [])


	return <HashRouter>
		<DropZoneProviderWrapper>
			<ThemeProviderWrapper>
				<GeneralProvidersWrapper>
					<App />
					<Route path="/Error">
						<ErrorPage />
					</Route>
					<ErrorBoundaryRedirect
						onErrorGoTo="/Error"
						onError={() => logger.error("There was an error with the app!")}
					>
						<Route path="/">
							<AppBackground page="Main">
								<Player />
							</AppBackground>
						</Route>
						<Route path="/Player">
							<AppBackground page="Main">
								<Player />
							</AppBackground>
						</Route>
						<Route path="/VsrgComposer">
							<AppBackground page="Composer">
								<VsrgComposer />
							</AppBackground>
						</Route>
						<Route path="/VsrgPlayer">
							<AppBackground page="Main">
								<VsrgPlayer />
							</AppBackground>
						</Route>
						<Route path="/Composer">
							<AppBackground page="Composer">
								<Composer />
							</AppBackground>
						</Route>
						<Route path="/Donate">
							<Donate />
						</Route>
						<Route path="/Changelog">
							<Changelogpage />
						</Route>
						<Route path="/Partners">
							<Partners />
						</Route>
						<Route path='/Help'>
							<Help />
						</Route>
						<Route path='/SheetVisualizer'>
							<SheetVisualizer />
						</Route>
						<Route path='/MidiSetup'>
							<MidiSetup />
						</Route>
						<Route path='/Theme'>
							<Theme />
						</Route>
						<Route path='/Privacy'>
							<Privacy />
						</Route>
						<Route path='/Keybinds'>
							<Keybinds />
						</Route>
						<Route path='/ZenKeyboard'>
							<AppBackground page="Main">
								<ZenKeyboard />
							</AppBackground>
						</Route>
						<Route path='/Backup'>
							<Backup />
						</Route>
					</ErrorBoundaryRedirect>
					<Route path='*'>
						<Error404 />
					</Route>
				</GeneralProvidersWrapper>
			</ThemeProviderWrapper>
		</DropZoneProviderWrapper>
	</HashRouter>
}