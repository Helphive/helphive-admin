// This is example of menu item without group for horizontal layout. There will be no children.

// third-party
import { FormattedMessage } from "react-intl";

// assets
import { Home2 } from "iconsax-react";

// type

// icons
const icons = {
	homePage: Home2,
};

// ==============================|| MENU ITEMS - SAMPLE PAGE ||============================== //

const homePage = {
	id: "home-page",
	title: <FormattedMessage id="home-page" />,
	type: "group",
	url: "/home",
	icon: icons.homePage,
};

export default homePage;
