import React, { useState } from 'react';
import {
  BellOff,
  Ban,
  ShieldAlert,
  Clock,
  Check,
  X,
  Unlock,
  Trash2,
} from 'lucide-react';
import { Contact, MuteDuration } from '../types/chat';

interface MuteModalProps {
  contact: Contact | null;
  onClose: () => void;
  onConfirmMute: (contactId: string, duration: MuteDuration, label: string) => void;
}

export const MuteModal: React.FC<MuteModalProps> = ({
  contact,
  onClose,
  onConfirmMute,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<'8h' | '1w' | 'always'>(
    (contact?.muteDuration as '8h' | '1w' | 'always') || '8h'
  );

  if (!contact) return null;

  const options: { id: '8h' | '1w' | 'always'; title: string; desc: string }[] = [
    {
      id: '8h',
      title: '8 ساعات',
      desc: 'مناسب لوقت العمل أو الاجتماعات اليومية',
    },
    {
      id: '1w',
      title: 'أسبوع واحد',
      desc: 'إيقاف تنبيهات الصوت لمدة 7 أيام',
    },
    {
      id: 'always',
      title: 'دائماً',
      desc: 'كتم دائم حتى تقوم بإلغائه يدوياً في أي وقت',
    },
  ];

  const handleApply = () => {
    const chosen = options.find((o) => o.id === selectedDuration)!;
    onConfirmMute(contact.id, selectedDuration, `مكتوم لمدة ${chosen.title}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <BellOff className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">
                كتم إشعارات {contact.name}
              </h3>
              <p className="text-xs text-slate-400">
                لن يصدر أي صوت عند وصول رسائل جديدة في هذه الدردشة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-6">
          {options.map((opt) => {
            const active = selectedDuration === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedDuration(opt.id)}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-right transition-all ${
                  active
                    ? 'border-amber-500/60 bg-amber-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock
                    className={`h-4 w-4 ${
                      active ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  />
                  <div>
                    <div className="text-sm font-semibold">{opt.title}</div>
                    <div className="text-xs text-slate-400">{opt.desc}</div>
                  </div>
                </div>
                {active && <Check className="h-4 w-4 text-amber-400" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 bg-slate-950/60 px-6 py-4">
          {contact.isMuted && (
            <button
              type="button"
              onClick={() => {
                onConfirmMute(contact.id, null, '');
                onClose();
              }}
              className="ml-auto rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 whitespace-nowrap shrink-0"
            >
              إلغاء الكتم الآن
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white whitespace-nowrap shrink-0"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-amber-500 whitespace-nowrap shrink-0"
          >
            تأكيد الكتم
          </button>
        </div>
      </div>
    </div>
  );
};

interface BlockModalProps {
  contact: Contact | null;
  onClose: () => void;
  onConfirmBlock: (
    contactId: string,
    blockState: boolean,
    clearMessages: boolean,
    reason: string
  ) => void;
}

export const BlockModal: React.FC<BlockModalProps> = ({
  contact,
  onClose,
  onConfirmBlock,
}) => {
  const [clearChatAlso, setClearChatAlso] = useState(false);
  const [reason, setReason] = useState('إزعاج أو رسائل غير مرغوب فيها');

  if (!contact) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                contact.isBlocked
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              {contact.isBlocked ? (
                <Unlock className="h-5 w-5" />
              ) : (
                <Ban className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">
                {contact.isBlocked
                  ? `إلغاء حظر ${contact.name}؟`
                  : `حظر ${contact.name}؟`}
              </h3>
              <p className="font-mono text-xs text-emerald-400 tabular-nums" dir="ltr">
                {contact.phone}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {contact.isBlocked ? (
            <p className="text-sm leading-relaxed text-slate-300">
              عند إلغاء الحظر، سيتمكن <strong className="text-white">{contact.name}</strong>{' '}
              (<span className="font-mono text-emerald-400 tabular-nums" dir="ltr">{contact.phone}</span>) من مراسلتك وإجراء مكالمات معك مجدداً.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 text-xs leading-relaxed text-slate-300">
                <div className="mb-1 flex items-center gap-2 font-semibold text-rose-300">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>ماذا يحدث عند حظر {contact.name}؟</span>
                </div>
                لن يتمكن صاحب هذا الرقم من إرسال رسائل لك أو الاتصال بك أو رؤية
                حالتك وآخر ظهور لك.
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  سبب الحظر (اختياري)
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-200 focus:border-rose-500 focus:outline-none"
                >
                  <option value="إزعاج أو رسائل غير مرغوب فيها">
                    إزعاج أو رسائل غير مرغوب فيها
                  </option>
                  <option value="رقم غير معروف / تسويقي">
                    رقم غير معروف / تسويقي
                  </option>
                  <option value="أسباب شخصية">أسباب شخصية</option>
                </select>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-300 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={clearChatAlso}
                  onChange={(e) => setClearChatAlso(e.target.checked)}
                  className="h-4 w-4 accent-rose-600"
                />
                <span className="flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                  مسح كافة الرسائل السابقة في هذه المحادثة أيضاً
                </span>
              </label>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 bg-slate-950/60 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white whitespace-nowrap shrink-0"
          >
            تراجع
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmBlock(
                contact.id,
                !contact.isBlocked,
                clearChatAlso,
                reason
              );
              onClose();
            }}
            className={`rounded-xl px-5 py-2.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 ${
              contact.isBlocked
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-rose-600 hover:bg-rose-500'
            }`}
          >
            {contact.isBlocked ? 'تأكيد إلغاء الحظر' : 'حظر الرقم الآن'}
          </button>
        </div>
      </div>
    </div>
  );
};
