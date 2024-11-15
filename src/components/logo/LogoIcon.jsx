// material-ui
import { useTheme } from "@mui/material/styles";
import logoIconDark from "assets/images/logo-icon-dark.png";
import logoIcon from "assets/images/logo-icon.png";

// ==============================|| LOGO ICON IMAGE ||============================== //

export default function LogoIcon() {
	const theme = useTheme();

	return <img src={theme.palette.mode === "dark" ? logoIconDark : logoIcon} alt="icon logo" width="40" />;
}
