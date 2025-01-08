import { lazy } from "react";

// project-imports
import Loadable from "components/Loadable";
import DashboardLayout from "layout/Dashboard";
import PagesLayout from "layout/Pages";
// import SimpleLayout from "layout/Simple";
// import { SimpleLayoutType } from "config";

const MaintenanceError = Loadable(lazy(() => import("pages/maintenance/error/404")));
const MaintenanceError500 = Loadable(lazy(() => import("pages/maintenance/error/500")));
const MaintenanceUnderConstruction = Loadable(
	lazy(() => import("pages/maintenance/under-construction/under-construction")),
);
const MaintenanceComingSoon = Loadable(lazy(() => import("pages/maintenance/coming-soon/coming-soon")));

// const AppContactUS = Loadable(lazy(() => import("pages/contact-us")));
// render - pages
const HomePage = Loadable(lazy(() => import("pages/home-page")));
const PendingApplicationsPage = Loadable(lazy(() => import("pages/provider-applications/pending-applications")));
const ReviewedApplicationsPage = Loadable(lazy(() => import("pages/provider-applications/reviewed-applications")));
const ManageDisputesPage = Loadable(lazy(() => import("pages/disputes/manage-disputes")));

// ==============================|| MAIN ROUTES ||============================== //

const MainRoutes = {
	path: "/",
	children: [
		{
			path: "/",
			element: <DashboardLayout />,
			children: [
				{
					path: "home",
					element: <HomePage />,
				},
				{
					path: "pending-applications",
					element: <PendingApplicationsPage />,
				},
				{
					path: "reviewed-applications",
					element: <ReviewedApplicationsPage />,
				},
				{
					path: "manage-disputes",
					element: <ManageDisputesPage />,
				},
			],
		},
		// {
		// 	path: "/",
		// 	element: <SimpleLayout layout={SimpleLayoutType.SIMPLE} />,
		// 	children: [
		// 		{
		// 			path: "contact-us",
		// 			element: <AppContactUS />,
		// 		},
		// 	],
		// },
		{
			path: "/maintenance",
			element: <PagesLayout />,
			children: [
				{
					path: "404",
					element: <MaintenanceError />,
				},
				{
					path: "500",
					element: <MaintenanceError500 />,
				},
				{
					path: "under-construction",
					element: <MaintenanceUnderConstruction />,
				},
				{
					path: "coming-soon",
					element: <MaintenanceComingSoon />,
				},
			],
		},
		{
			path: "*",
			element: <MaintenanceError />,
		},
	],
};

export default MainRoutes;
