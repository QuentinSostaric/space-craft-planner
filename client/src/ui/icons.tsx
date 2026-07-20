/**
 * Icon set — PrimeIcons rendered through the design-system engine.
 *
 * Each export mirrors the name of the icon it replaced so call sites keep
 * reading naturally; all accept `sx` (fontSize, color…) like before.
 */
import { Box } from './system';
import type { BoxProps, OmitProps, SxValue } from './system';

export interface IconProps extends OmitProps<BoxProps, 'component'> {
  sx?: SxValue;
}

function makeIcon(pi: string, displayName: string) {
  function Icon({ sx, className, ...rest }: IconProps) {
    return (
      <Box
        component="i"
        aria-hidden="true"
        className={[`pi ${pi}`, className].filter(Boolean).join(' ')}
        sx={[{ fontSize: '1.25rem', lineHeight: 1, display: 'inline-block' }, sx]}
        {...rest}
      />
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

// ── Navigation / chrome ──────────────────────────────────────────────────────
export const SearchIcon = makeIcon('pi-search', 'SearchIcon');
export const SearchOutlinedIcon = SearchIcon;
export const CloseIcon = makeIcon('pi-times', 'CloseIcon');
export const ChevronRightIcon = makeIcon('pi-chevron-right', 'ChevronRightIcon');
export const ChevronRightOutlinedIcon = ChevronRightIcon;
export const KeyboardArrowRightIcon = ChevronRightIcon;
export const KeyboardArrowLeftIcon = makeIcon('pi-chevron-left', 'KeyboardArrowLeftIcon');
export const ExpandMoreIcon = makeIcon('pi-chevron-down', 'ExpandMoreIcon');
export const MoreHorizIcon = makeIcon('pi-ellipsis-h', 'MoreHorizIcon');
export const ArrowForwardIcon = makeIcon('pi-arrow-right', 'ArrowForwardIcon');
export const OpenInNewIcon = makeIcon('pi-external-link', 'OpenInNewIcon');
export const TuneIcon = makeIcon('pi-sliders-h', 'TuneIcon');
export const FilterListOffOutlinedIcon = makeIcon('pi-filter-slash', 'FilterListOffOutlinedIcon');
export const GridViewOutlinedIcon = makeIcon('pi-th-large', 'GridViewOutlinedIcon');
export const DragIndicatorIcon = makeIcon('pi-bars', 'DragIndicatorIcon');

// ── Status / feedback ────────────────────────────────────────────────────────
export const CheckIcon = makeIcon('pi-check', 'CheckIcon');
export const CheckCircleIcon = makeIcon('pi-check-circle', 'CheckCircleIcon');
export const CheckCircleOutlineIcon = CheckCircleIcon;
export const CheckCircleOutlineOutlinedIcon = CheckCircleIcon;
export const RadioButtonUncheckedIcon = makeIcon('pi-circle', 'RadioButtonUncheckedIcon');
export const FiberManualRecordIcon = makeIcon('pi-circle-fill', 'FiberManualRecordIcon');
export const InfoOutlinedIcon = makeIcon('pi-info-circle', 'InfoOutlinedIcon');
export const ErrorOutlineIcon = makeIcon('pi-exclamation-circle', 'ErrorOutlineIcon');
export const VerifiedOutlinedIcon = makeIcon('pi-verified', 'VerifiedOutlinedIcon');
export const VerifiedUserOutlinedIcon = makeIcon('pi-shield', 'VerifiedUserOutlinedIcon');
export const AutoAwesomeIcon = makeIcon('pi-sparkles', 'AutoAwesomeIcon');

// ── Actions ──────────────────────────────────────────────────────────────────
export const AddIcon = makeIcon('pi-plus', 'AddIcon');
export const AddOutlinedIcon = AddIcon;
export const AddCircleOutlineOutlinedIcon = makeIcon('pi-plus-circle', 'AddCircleOutlineOutlinedIcon');
export const RemoveIcon = makeIcon('pi-minus', 'RemoveIcon');
export const DeleteOutlineIcon = makeIcon('pi-trash', 'DeleteOutlineIcon');
export const DeleteOutlineOutlinedIcon = DeleteOutlineIcon;
export const EditOutlinedIcon = makeIcon('pi-pencil', 'EditOutlinedIcon');
export const ContentCopyIcon = makeIcon('pi-copy', 'ContentCopyIcon');
export const RefreshIcon = makeIcon('pi-refresh', 'RefreshIcon');
export const RefreshOutlinedIcon = RefreshIcon;
export const SyncIcon = makeIcon('pi-sync', 'SyncIcon');
export const CloudSyncOutlinedIcon = makeIcon('pi-cloud-upload', 'CloudSyncOutlinedIcon');
export const DownloadOutlinedIcon = makeIcon('pi-download', 'DownloadOutlinedIcon');
export const SystemUpdateAltIcon = makeIcon('pi-download', 'SystemUpdateAltIcon');
export const ShareOutlinedIcon = makeIcon('pi-share-alt', 'ShareOutlinedIcon');
export const LogoutOutlinedIcon = makeIcon('pi-sign-out', 'LogoutOutlinedIcon');
export const PlaylistAddIcon = makeIcon('pi-list-check', 'PlaylistAddIcon');
export const PlaylistAddOutlinedIcon = PlaylistAddIcon;
export const AddTaskOutlinedIcon = makeIcon('pi-check-square', 'AddTaskOutlinedIcon');
export const PushPinOutlinedIcon = makeIcon('pi-thumbtack', 'PushPinOutlinedIcon');

// ── Domain / content ─────────────────────────────────────────────────────────
export const DescriptionOutlinedIcon = makeIcon('pi-file', 'DescriptionOutlinedIcon');
export const FlagIcon = makeIcon('pi-flag-fill', 'FlagIcon');
export const FlagOutlinedIcon = makeIcon('pi-flag', 'FlagOutlinedIcon');
export const ScienceOutlinedIcon = makeIcon('pi-sparkles', 'ScienceOutlinedIcon');
export const PlaceOutlinedIcon = makeIcon('pi-map-marker', 'PlaceOutlinedIcon');
export const PublicOutlinedIcon = makeIcon('pi-globe', 'PublicOutlinedIcon');
export const TravelExploreIcon = makeIcon('pi-compass', 'TravelExploreIcon');
export const TravelExploreOutlinedIcon = TravelExploreIcon;
export const RouteOutlinedIcon = makeIcon('pi-directions', 'RouteOutlinedIcon');
export const GroupsIcon = makeIcon('pi-users', 'GroupsIcon');
export const GroupsOutlinedIcon = GroupsIcon;
export const PersonOutlineOutlinedIcon = makeIcon('pi-user', 'PersonOutlineOutlinedIcon');
export const BusinessOutlinedIcon = makeIcon('pi-building', 'BusinessOutlinedIcon');
export const ForumOutlinedIcon = makeIcon('pi-comments', 'ForumOutlinedIcon');
export const MarkEmailUnreadOutlinedIcon = makeIcon('pi-envelope', 'MarkEmailUnreadOutlinedIcon');
export const AssignmentIcon = makeIcon('pi-clipboard', 'AssignmentIcon');
export const Inventory2Icon = makeIcon('pi-box', 'Inventory2Icon');
export const Inventory2OutlinedIcon = Inventory2Icon;
export const ViewInArOutlinedIcon = makeIcon('pi-box', 'ViewInArOutlinedIcon');
export const CategoryOutlinedIcon = makeIcon('pi-tags', 'CategoryOutlinedIcon');
export const SellOutlinedIcon = makeIcon('pi-tag', 'SellOutlinedIcon');
export const FolderOpenOutlinedIcon = makeIcon('pi-folder-open', 'FolderOpenOutlinedIcon');
export const DifferenceOutlinedIcon = makeIcon('pi-clone', 'DifferenceOutlinedIcon');
export const HubOutlinedIcon = makeIcon('pi-sitemap', 'HubOutlinedIcon');
export const LeaderboardOutlinedIcon = makeIcon('pi-chart-bar', 'LeaderboardOutlinedIcon');
export const MilitaryTechOutlinedIcon = makeIcon('pi-trophy', 'MilitaryTechOutlinedIcon');
export const PaidOutlinedIcon = makeIcon('pi-wallet', 'PaidOutlinedIcon');
export const SmartToyOutlinedIcon = makeIcon('pi-microchip', 'SmartToyOutlinedIcon');
export const RocketLaunchOutlinedIcon = makeIcon('pi-send', 'RocketLaunchOutlinedIcon');
export const ElectricBoltIcon = makeIcon('pi-bolt', 'ElectricBoltIcon');
export const SpeedOutlinedIcon = makeIcon('pi-gauge', 'SpeedOutlinedIcon');
export const StraightenOutlinedIcon = makeIcon('pi-arrows-h', 'StraightenOutlinedIcon');
export const BuildOutlinedIcon = makeIcon('pi-wrench', 'BuildOutlinedIcon');
export const HandymanOutlinedIcon = makeIcon('pi-hammer', 'HandymanOutlinedIcon');
export const AccessTimeIcon = makeIcon('pi-clock', 'AccessTimeIcon');
export const AccessTimeOutlinedIcon = AccessTimeIcon;
export const VisibilityOutlinedIcon = makeIcon('pi-eye', 'VisibilityOutlinedIcon');
export const ImageNotSupportedOutlinedIcon = makeIcon('pi-image', 'ImageNotSupportedOutlinedIcon');

// ── Stars / favourites ───────────────────────────────────────────────────────
export const StarIcon = makeIcon('pi-star-fill', 'StarIcon');
export const StarBorderIcon = makeIcon('pi-star', 'StarBorderIcon');
export const StarOutlineIcon = StarBorderIcon;

// ── Theme toggle ─────────────────────────────────────────────────────────────
export const LightModeOutlinedIcon = makeIcon('pi-sun', 'LightModeOutlinedIcon');
export const DarkModeOutlinedIcon = makeIcon('pi-moon', 'DarkModeOutlinedIcon');
