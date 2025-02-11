import { HashRouter, Route, Switch } from "react-router-dom";
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
					<Switch>
						<Route exact path="/Error">
							<ErrorPage />
						</Route>
						<ErrorBoundaryRedirect
							onErrorGoTo="/Error"
							onError={() => logger.error("There was an error with the app!")}
						>
							<Route exact path="/">
								<AppBackground page="Main">
									<Player />
								</AppBackground>
							</Route>
							<Route exact path="/Player">
								<AppBackground page="Main">
									<Player />
								</AppBackground>
							</Route>
							<Route exact path="/VsrgComposer">
								<AppBackground page="Composer">
									<VsrgComposer />
								</AppBackground>
							</Route>
							<Route exact path="/VsrgPlayer">
								<AppBackground page="Main">
									<VsrgPlayer />
								</AppBackground>
							</Route>
							<Route exact path="/Composer">
								<AppBackground page="Composer">
									<Composer />
								</AppBackground>
							</Route>
							<Route exact path="/Donate">
								<Donate />
							</Route>
							<Route exact path="/Changelog">
								<Changelogpage />
							</Route>
							<Route exact path="/Partners">
								<Partners />
							</Route>
							<Route exact path='/Help'>
								<Help />
							</Route>
							<Route exact path='/SheetVisualizer'>
								<SheetVisualizer />
							</Route>
							<Route exact path='/MidiSetup'>
								<MidiSetup />
							</Route>
							<Route exact path='/Theme'>
								<Theme />
							</Route>
							<Route exact path='/Privacy'>
								<Privacy />
							</Route>
							<Route exact path='/Keybinds'>
								<Keybinds />
							</Route>
							<Route exact path='/ZenKeyboard'>
								<AppBackground page="Main">
									<ZenKeyboard />
								</AppBackground>
							</Route>
							<Route exact path='/Backup'>
								<Backup />
							</Route>
						</ErrorBoundaryRedirect>
						<Route path='*'>
							<Error404 />
						</Route>
					</Switch>
				</GeneralProvidersWrapper>
			</ThemeProviderWrapper>
		</DropZoneProviderWrapper>
	</HashRouter>
}