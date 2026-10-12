import type { ButtonHTMLAttributes } from 'react';
import { IonIcon } from '@ionic/react';
import { createOutline, trashOutline } from 'ionicons/icons';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label' | 'title'> & {
  action: 'edit' | 'remove';
  label: string;
};

export function ActionIconButton({ action, label, className = '', ...props }: Props) {
  return (
    <button
      type="button"
      {...props}
      className={`action-icon-button action-icon-button--${action} ${className}`.trim()}
      aria-label={label}
      title={label}
    >
      <IonIcon icon={action === 'edit' ? createOutline : trashOutline} aria-hidden="true" />
    </button>
  );
}
