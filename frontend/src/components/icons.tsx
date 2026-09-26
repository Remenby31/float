import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.65"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (props: IconProps) => <Icon {...props}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></Icon>;
export const MenuIcon = (props: IconProps) => <Icon {...props}><path d="M4 6h16M4 12h16M4 18h16" /></Icon>;
export const CloseIcon = (props: IconProps) => <Icon {...props}><path d="m18 6-12 12M6 6l12 12" /></Icon>;
export const PlusIcon = (props: IconProps) => <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>;
export const TrashIcon = (props: IconProps) => <Icon {...props}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Icon>;
export const UndoIcon = (props: IconProps) => <Icon {...props}><path d="m9 14-5-5 5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Icon>;
export const RedoIcon = (props: IconProps) => <Icon {...props}><path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></Icon>;
export const ChevronDownIcon = (props: IconProps) => <Icon {...props}><path d="m6 9 6 6 6-6" /></Icon>;
export const ChevronRightIcon = (props: IconProps) => <Icon {...props}><path d="m9 18 6-6-6-6" /></Icon>;
export const ChevronLeftIcon = (props: IconProps) => <Icon {...props}><path d="m15 18-6-6 6-6" /></Icon>;
export const CalendarIcon = (props: IconProps) => <Icon {...props}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>;
export const ClockIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
export const PaperclipIcon = (props: IconProps) => <Icon {...props}><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></Icon>;
export const SunIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.41M17.66 6.34l1.41-1.41" /></Icon>;
export const MoonIcon = (props: IconProps) => <Icon {...props}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></Icon>;
export const CheckIcon = (props: IconProps) => <Icon {...props}><path d="m5 12 4 4L19 6" /></Icon>;
export const GripIcon = (props: IconProps) => <Icon {...props}><path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" strokeWidth="3" /></Icon>;
