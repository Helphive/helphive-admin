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

const providerApplications = {
	id: "group-provider-applications",
	title: <FormattedMessage id="provider applications" />,
	type: "group",
	children: [
		{
			id: "pending-applications",
			title: <FormattedMessage id="pending-applications" />,
			type: "item",
			url: "/pending-applications",
			icon: icons.pendingApplications,
			target: false,
		},
		{
			id: "reviewed-applications",
			title: <FormattedMessage id="reviewed-applications" />,
			type: "item",
			url: "/reviewed-applications",
			icon: icons.reviewedApplications,
			target: false,
		},
	],
};

export default providerApplications;
