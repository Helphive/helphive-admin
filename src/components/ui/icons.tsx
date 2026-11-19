// The one icon module. Every icon in the app comes from here, under a semantic name, so the
// family (Phosphor) can be swapped in one place. Rules: design-system.md, "Icons".
//
// - Default: regular weight, 20px, colour from the surrounding text (currentColor).
// - `weight="bold"` only where an icon is 16px or smaller (meta rows, inline checks).
// - `weight="fill"` only for the active navigation item or a selected state.
// - `weight="duotone"` only where the icon is the main visual (service tiles, empty states,
//   landing feature points), in coral on a coral-50 tile.
// Icons are decorative (aria-hidden) unless given `aria-label` or `titleAccess`.
import { forwardRef, type CSSProperties } from 'react';
import { styled, type SxProps, type Theme } from '@mui/material/styles';
import {
    ArrowDownIcon,
    ArrowUpIcon,
    ArrowsClockwiseIcon,
    ArrowsOutSimpleIcon,
    ColumnsIcon,
    FileCsvIcon,
    FilePdfIcon,
    MagnifyingGlassIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
    RowsIcon,
    SidebarSimpleIcon,
    SquaresFourIcon,
    UserListIcon,
    XCircleIcon,
    ArrowClockwiseIcon,
    ArrowSquareOutIcon,
    BedIcon,
    BroomIcon,
    CalendarBlankIcon,
    CaretDownIcon,
    CaretLeftIcon,
    CaretRightIcon,
    CaretUpDownIcon,
    CheckCircleIcon,
    CheckSquareIcon,
    CircleIcon,
    CopyIcon,
    DownloadSimpleIcon,
    EyeIcon,
    EyeSlashIcon,
    FileTextIcon,
    ImageIcon,
    InfoIcon as PhInfoIcon,
    ListIcon,
    LockSimpleIcon,
    MinusSquareIcon,
    RadioButtonIcon,
    SignOutIcon,
    SquareIcon,
    ShirtFoldedIcon,
    UserIcon,
    WarningCircleIcon,
    WarningIcon as PhWarningIcon,
    XIcon,
    ShieldCheckIcon,
    ShieldSlashIcon,
    DevicesIcon,
    PasswordIcon as PhPasswordIcon,
    UsersThreeIcon,
    ScrollIcon,
    UserGearIcon,
    PlusIcon,
    ProhibitIcon,
    EyeClosedIcon,
    ClockCounterClockwiseIcon,
    CalendarCheckIcon as PhCalendarCheckIcon,
    UsersIcon as PhUsersIcon,
    CreditCardIcon as PhCreditCardIcon,
    CoinsIcon as PhCoinsIcon,
    BankIcon as PhBankIcon,
    MapTrifoldIcon as PhMapTrifoldIcon,
    ReceiptIcon as PhReceiptIcon,
    PrinterIcon as PhPrinterIcon,
    NotePencilIcon as PhNotePencilIcon,
    PencilSimpleIcon as PhPencilSimpleIcon,
    TrashIcon as PhTrashIcon,
    ArrowCounterClockwiseIcon as PhArrowCounterClockwiseIcon,
    EnvelopeSimpleIcon as PhEnvelopeSimpleIcon,
    SealCheckIcon as PhSealCheckIcon,
    WifiSlashIcon as PhWifiSlashIcon,
    PulseIcon as PhPulseIcon,
    ArrowUUpLeftIcon as PhArrowUUpLeftIcon,
    UserMinusIcon as PhUserMinusIcon,
    WrenchIcon as PhWrenchIcon,
    MapPinIcon as PhMapPinIcon,
    WalletIcon as PhWalletIcon,
    BroadcastIcon as PhBroadcastIcon,
    ChartLineUpIcon,
    CurrencyCircleDollarIcon,
    HeartbeatIcon,
    IdentificationBadgeIcon,
    GridFourIcon,
    FlaskIcon,
    BookmarkSimpleIcon,
    ChartBarIcon,
    ShieldWarningIcon,
    TrayIcon,
    SlidersHorizontalIcon,
    ListChecksIcon,
    HandPalmIcon,
    GraphIcon,
    PlayIcon,
    type Icon as PhosphorIcon,
    type IconProps as PhosphorIconProps,
    type IconWeight,
} from '@phosphor-icons/react';

export type { IconWeight };

/** MUI-style size keywords; MUI passes these to icons it renders itself (checkbox, alert). */
type IconFontSize = 'inherit' | 'small' | 'medium' | 'large';
const FONT_SIZE: Record<IconFontSize, string> = {
    inherit: 'inherit',
    small: '1.25rem',
    medium: '1.5rem',
    large: '2rem',
};

export interface AppIconProps extends Omit<PhosphorIconProps, 'size' | 'ref'> {
    /** Pixel size; wins over any container rule. Leave unset to follow the default or the container. */
    size?: number | string;
    fontSize?: IconFontSize;
    sx?: SxProps<Theme>;
    /** Accessible name; makes the icon visible to screen readers. */
    titleAccess?: string;
}

export type AppIcon = ReturnType<typeof icon>;

function icon(Glyph: PhosphorIcon, displayName: string) {
    // The svg is always 1em, so its size follows font-size: the 20px default below, a container's
    // `& svg { fontSize }`, or the `size` prop. MuiSvgIcon-root keeps theme rules that size
    // MUI icons (menu items, bottom navigation, buttons) applying to these too.
    const Root = styled(Glyph)({
        display: 'inline-block',
        flexShrink: 0,
        fontSize: '1.25rem',
        userSelect: 'none',
        verticalAlign: '-0.125em',
    });
    const Component = forwardRef<SVGSVGElement, AppIconProps>(function AppIcon(
        { size, fontSize, sx, titleAccess, className, style, weight = 'regular', ...rest },
        ref
    ) {
        const labelled = Boolean(titleAccess || rest['aria-label']);
        const sized: CSSProperties | undefined =
            size !== undefined ? { fontSize: size, ...style } : style;
        return (
            <Root
                ref={ref}
                size="1em"
                weight={weight}
                className={['MuiSvgIcon-root', className].filter(Boolean).join(' ')}
                style={sized}
                sx={[
                    fontSize ? { fontSize: FONT_SIZE[fontSize] } : {},
                    ...(Array.isArray(sx) ? sx : [sx]),
                ]}
                alt={titleAccess}
                aria-hidden={labelled ? undefined : true}
                role={labelled ? 'img' : undefined}
                focusable="false"
                {...rest}
            />
        );
    });
    Component.displayName = displayName;
    return Component;
}

/* Services */
export const RoomAttendantIcon = /* @__PURE__ */ icon(BedIcon, 'RoomAttendantIcon');
export const PublicAreaIcon = /* @__PURE__ */ icon(BroomIcon, 'PublicAreaIcon');
export const LinenPorterIcon = /* @__PURE__ */ icon(ShirtFoldedIcon, 'LinenPorterIcon');

/* Navigation and account */
export const LogoutIcon = /* @__PURE__ */ icon(SignOutIcon, 'LogoutIcon');
export const MenuIcon = /* @__PURE__ */ icon(ListIcon, 'MenuIcon');
export const CloseIcon = /* @__PURE__ */ icon(XIcon, 'CloseIcon');
export const ChevronDownIcon = /* @__PURE__ */ icon(CaretDownIcon, 'ChevronDownIcon');
export const ChevronLeftIcon = /* @__PURE__ */ icon(CaretLeftIcon, 'ChevronLeftIcon');
export const ChevronRightIcon = /* @__PURE__ */ icon(CaretRightIcon, 'ChevronRightIcon');
export const ExternalLinkIcon = /* @__PURE__ */ icon(ArrowSquareOutIcon, 'ExternalLinkIcon');

/* Actions */
export const RefreshIcon = /* @__PURE__ */ icon(ArrowClockwiseIcon, 'RefreshIcon');
export const CopyTextIcon = /* @__PURE__ */ icon(CopyIcon, 'CopyTextIcon');
export const DownloadIcon = /* @__PURE__ */ icon(DownloadSimpleIcon, 'DownloadIcon');
export const ShowPasswordIcon = /* @__PURE__ */ icon(EyeIcon, 'ShowPasswordIcon');
export const HidePasswordIcon = /* @__PURE__ */ icon(EyeSlashIcon, 'HidePasswordIcon');

/* Booking details */
export const CalendarIcon = /* @__PURE__ */ icon(CalendarBlankIcon, 'CalendarIcon');
export const PersonIcon = /* @__PURE__ */ icon(UserIcon, 'PersonIcon');
export const SecureIcon = /* @__PURE__ */ icon(LockSimpleIcon, 'SecureIcon');
export const DocumentIcon = /* @__PURE__ */ icon(FileTextIcon, 'DocumentIcon');
export const PhotoIcon = /* @__PURE__ */ icon(ImageIcon, 'PhotoIcon');

/* Console */
export const OverviewIcon = /* @__PURE__ */ icon(SquaresFourIcon, 'OverviewIcon');
export const ApplicationsIcon = /* @__PURE__ */ icon(UserListIcon, 'ApplicationsIcon');
export const SearchIcon = /* @__PURE__ */ icon(MagnifyingGlassIcon, 'SearchIcon');
export const SidebarIcon = /* @__PURE__ */ icon(SidebarSimpleIcon, 'SidebarIcon');
export const ColumnsSettingIcon = /* @__PURE__ */ icon(ColumnsIcon, 'ColumnsSettingIcon');
export const DensityIcon = /* @__PURE__ */ icon(RowsIcon, 'DensityIcon');
export const ExportCsvIcon = /* @__PURE__ */ icon(FileCsvIcon, 'ExportCsvIcon');
export const SortAscIcon = /* @__PURE__ */ icon(ArrowUpIcon, 'SortAscIcon');
export const SortDescIcon = /* @__PURE__ */ icon(ArrowDownIcon, 'SortDescIcon');
export const SortNoneIcon = /* @__PURE__ */ icon(CaretUpDownIcon, 'SortNoneIcon');
export const ZoomInIcon = /* @__PURE__ */ icon(MagnifyingGlassPlusIcon, 'ZoomInIcon');
export const ZoomOutIcon = /* @__PURE__ */ icon(MagnifyingGlassMinusIcon, 'ZoomOutIcon');
export const RotateIcon = /* @__PURE__ */ icon(ArrowsClockwiseIcon, 'RotateIcon');
export const FitIcon = /* @__PURE__ */ icon(ArrowsOutSimpleIcon, 'FitIcon');
export const PdfIcon = /* @__PURE__ */ icon(FilePdfIcon, 'PdfIcon');
export const ApproveIcon = /* @__PURE__ */ icon(CheckCircleIcon, 'ApproveIcon');
export const AddIcon = /* @__PURE__ */ icon(PlusIcon, 'AddIcon');
export const DisableIcon = /* @__PURE__ */ icon(ProhibitIcon, 'DisableIcon');
export const HistoryIcon = /* @__PURE__ */ icon(ClockCounterClockwiseIcon, 'HistoryIcon');

/* Security and accounts */
export const TwoStepIcon = /* @__PURE__ */ icon(ShieldCheckIcon, 'TwoStepIcon');
export const TwoStepOffIcon = /* @__PURE__ */ icon(ShieldSlashIcon, 'TwoStepOffIcon');
export const SessionsIcon = /* @__PURE__ */ icon(DevicesIcon, 'SessionsIcon');
export const PasswordIcon = /* @__PURE__ */ icon(PhPasswordIcon, 'PasswordIcon');
export const AdminsIcon = /* @__PURE__ */ icon(UsersThreeIcon, 'AdminsIcon');
export const AuditIcon = /* @__PURE__ */ icon(ScrollIcon, 'AuditIcon');
export const AccountIcon = /* @__PURE__ */ icon(UserGearIcon, 'AccountIcon');
export const HiddenIcon = /* @__PURE__ */ icon(EyeClosedIcon, 'HiddenIcon');
export const RejectIcon = /* @__PURE__ */ icon(XCircleIcon, 'RejectIcon');

/* Operations */
export const BookingsIcon = /* @__PURE__ */ icon(PhCalendarCheckIcon, 'BookingsIcon');
export const UsersIcon = /* @__PURE__ */ icon(PhUsersIcon, 'UsersIcon');
export const PaymentsIcon = /* @__PURE__ */ icon(PhCreditCardIcon, 'PaymentsIcon');
export const EarningsIcon = /* @__PURE__ */ icon(PhCoinsIcon, 'EarningsIcon');
export const PayoutsIcon = /* @__PURE__ */ icon(PhBankIcon, 'PayoutsIcon');
export const LiveIcon = /* @__PURE__ */ icon(PhMapTrifoldIcon, 'LiveIcon');
export const ReceiptIcon = /* @__PURE__ */ icon(PhReceiptIcon, 'ReceiptIcon');
export const PrintIcon = /* @__PURE__ */ icon(PhPrinterIcon, 'PrintIcon');
export const NoteIcon = /* @__PURE__ */ icon(PhNotePencilIcon, 'NoteIcon');
export const EditIcon = /* @__PURE__ */ icon(PhPencilSimpleIcon, 'EditIcon');
export const DeleteIcon = /* @__PURE__ */ icon(PhTrashIcon, 'DeleteIcon');
export const ReinstateIcon = /* @__PURE__ */ icon(PhArrowCounterClockwiseIcon, 'ReinstateIcon');
export const EmailIcon = /* @__PURE__ */ icon(PhEnvelopeSimpleIcon, 'EmailIcon');
export const VerifiedIcon = /* @__PURE__ */ icon(PhSealCheckIcon, 'VerifiedIcon');
export const OfflineIcon = /* @__PURE__ */ icon(PhWifiSlashIcon, 'OfflineIcon');
export const ActivityIcon = /* @__PURE__ */ icon(PhPulseIcon, 'ActivityIcon');
export const RefundIcon = /* @__PURE__ */ icon(PhArrowUUpLeftIcon, 'RefundIcon');
export const ReleaseIcon = /* @__PURE__ */ icon(PhUserMinusIcon, 'ReleaseIcon');
export const ResolveIcon = /* @__PURE__ */ icon(PhWrenchIcon, 'ResolveIcon');
export const LocationIcon = /* @__PURE__ */ icon(PhMapPinIcon, 'LocationIcon');
export const BalanceIcon = /* @__PURE__ */ icon(PhWalletIcon, 'BalanceIcon');
export const OnlineIcon = /* @__PURE__ */ icon(PhBroadcastIcon, 'OnlineIcon');
// Risk
export const RiskIcon = /* @__PURE__ */ icon(ShieldWarningIcon, 'RiskIcon');
export const ReviewQueueIcon = /* @__PURE__ */ icon(TrayIcon, 'ReviewQueueIcon');
export const RulesIcon = /* @__PURE__ */ icon(SlidersHorizontalIcon, 'RulesIcon');
export const ListsIcon = /* @__PURE__ */ icon(ListChecksIcon, 'ListsIcon');
export const HoldIcon = /* @__PURE__ */ icon(HandPalmIcon, 'HoldIcon');
export const LinkedAccountsIcon = /* @__PURE__ */ icon(GraphIcon, 'LinkedAccountsIcon');
export const RunIcon = /* @__PURE__ */ icon(PlayIcon, 'RunIcon');

/* Status and feedback */
export const InfoIcon = /* @__PURE__ */ icon(PhInfoIcon, 'InfoIcon');
export const ErrorIcon = /* @__PURE__ */ icon(WarningCircleIcon, 'ErrorIcon');
export const WarningIcon = /* @__PURE__ */ icon(PhWarningIcon, 'WarningIcon');
export const SuccessIcon = /* @__PURE__ */ icon(CheckCircleIcon, 'SuccessIcon');

/* Form controls (used by the theme for MUI's own icons) */
export const CheckboxIcon = /* @__PURE__ */ icon(SquareIcon, 'CheckboxIcon');
export const CheckboxCheckedIcon = /* @__PURE__ */ icon(CheckSquareIcon, 'CheckboxCheckedIcon');
export const CheckboxIndeterminateIcon = /* @__PURE__ */ icon(
    MinusSquareIcon,
    'CheckboxIndeterminateIcon'
);
export const RadioIcon = /* @__PURE__ */ icon(CircleIcon, 'RadioIcon');
export const RadioCheckedIcon = /* @__PURE__ */ icon(RadioButtonIcon, 'RadioCheckedIcon');

// Analytics
export const AnalyticsIcon = /* @__PURE__ */ icon(ChartLineUpIcon, 'AnalyticsIcon');
export const BookingsChartIcon = /* @__PURE__ */ icon(ChartBarIcon, 'BookingsChartIcon');
export const RevenueIcon = /* @__PURE__ */ icon(CurrencyCircleDollarIcon, 'RevenueIcon');
export const HealthIcon = /* @__PURE__ */ icon(HeartbeatIcon, 'HealthIcon');
export const CustomersIcon = /* @__PURE__ */ icon(PhUsersIcon, 'CustomersIcon');
export const ProvidersIcon = /* @__PURE__ */ icon(IdentificationBadgeIcon, 'ProvidersIcon');
export const SupplyDemandIcon = /* @__PURE__ */ icon(GridFourIcon, 'SupplyDemandIcon');
export const ExplorerIcon = /* @__PURE__ */ icon(FlaskIcon, 'ExplorerIcon');
export const SavedViewIcon = /* @__PURE__ */ icon(BookmarkSimpleIcon, 'SavedViewIcon');
