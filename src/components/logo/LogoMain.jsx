// material-ui
import { useTheme } from "@mui/material/styles";

import logoDark from "assets/images/logo-dark.png";
import logo from "assets/images/logo.png";

export default function LogoMain() {
	const theme = useTheme();

	return <img src={theme.palette.mode === "dark" ? logoDark : logo} alt="icon logo" width="180" />;
}
