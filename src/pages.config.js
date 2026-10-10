import Chat from './pages/Chat';
import Doctors from './pages/Doctors';
import Face from './pages/Face';
import History from './pages/History';
import Home from './pages/Home';
import Voice from './pages/Voice';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Chat": Chat,
    "Doctors": Doctors,
    "Face": Face,
    "History": History,
    "Home": Home,
    "Voice": Voice,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};