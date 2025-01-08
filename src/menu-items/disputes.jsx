// third-party
import { FormattedMessage } from "react-intl";

// assets
import { UserAdd, UserTick } from "iconsax-react";

// type

// icons
const icons = {
	pendingApplications: UserAdd,
	reviewedApplications: UserTick,
};

// ==============================|| MENU ITEMS - PROVIDER APPLICATIONS ||============================== //

const disputes = {
	id: "group-disputes",
	title: <FormattedMessage id="disputes" />,
	type: "group",
	children: [
		{
			id: "manage-disputes",
			title: <FormattedMessage id="manage-disputes" />,
			type: "item",
			url: "/manage-disputes",
			icon: icons.pendingApplications,
			target: false,
		},
	],
};

export default disputes;
