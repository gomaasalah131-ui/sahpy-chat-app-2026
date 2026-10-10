import React, { useState } from 'react';
import {
  X,
  BellOff,
  Bell,
  Ban,
  Unlock,
  Trash2,
  ShieldCheck,
  Image as ImageIcon,
  FileText,
  Link2,
  Palette,
  Clock,
  Star,
  Copy,
  Check,
  Smartphone,
  Users,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { Contact, GroupMember } from '../types/chat';
import { WALLPAPER_THEMES } from './AnimatedChatBackground';

interface ContactInfoDrawerProps {
  contact: Contact;
  allContacts?: Contact[];
  isOpen: boolean;
  onClose: () => void;
  onOpenMuteModal: () => void;
  onUnmuteQuick: () => void;
  onOpenBlockModal: () => void;
  onClearChat: () => void;
  onOpenWallpaperStudio: () => void;
  onToggleDisappearing: (val: 'off' | '24h' | '7d' | '90d') => void;
  onAddGroupMember?: (groupId: string, member: GroupMember) => void;
  onRemoveGroupMember?: (groupId: string, memberId: string) => void;
}

export const ContactInfoDrawer: React.FC<ContactInfoDrawerProps> = ({
  contact,
  allContacts = [],
  isOpen,
  onClose,
  onOpenMuteModal,
  onUnmuteQuick,
  onOpenBlockModal,
  onClearChat,
  onOpenWallpaperStudio,
  onToggleDisappearing,
  onAddGroupMember,
  onRemoveGroupMember,
}) => {
  const [mediaTab, setMediaTab] = useState<'image' | 'file' | 'link'>('image');
  const [imgError, setImgError] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [showAddMemberBox, setShowAddMemberBox] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  if (!isOpen) return null;

  const filteredMedia = (contact.sharedMedia || []).filter(
    (m) => m.type === mediaTab
  );
  const starredMessages = (contact.messages || []).filter((m) => m.isStarred);
  const currentTheme = WALLPAPER_THEMES.find(
    (t) => t.id === contact.customWallpaper
  );

  const handleCopyPhone = () => {
    navigator.clipboard?.writeText(contact.phone || '');
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const groupMembers = contact.groupMembers || [];
  const nonGroupContactsNotYetInGroup = allContacts.filter(
    (c) =>
      !c.isGroup &&
      !c.isBlocked &&
      !groupMembers.some(
        (gm) =>
          gm.id === c.id ||
          gm.phone.replace(/\D/g, '') === (c.phone || '').replace(/\D/g, '')
      )
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm">
      <div className="flex-1" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-r border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
          <h2 className="font-display text-base font-bold text-white">
            {contact.isGroup
              ? 'معلومات المجموعة والأعضاء المشاركين'
              : 'معلومات جهة الاتصال والرقم المسجل'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="إغلاق معلومات الاتصال"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Avatar & Identity */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4 h-28 w-28 overflow-hidden rounded-full ring-4 ring-slate-800">
              {contact.avatar && !imgError ? (
                <img
                  src={contact.avatar}
                  alt={contact.name}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className={`flex h-full w-full items-center justify-center text-3xl font-bold text-white ${contact.avatarFallbackColor}`}
                >
                  {contact.isGroup ? (
                    <Users className="h-12 w-12 text-white" />
                  ) : (
                    (contact.name || 'م').slice(0, 2)
                  )}
                </div>
              )}
            </div>

            <h3 className="font-display text-xl font-bold text-white">
              {contact.name}
            </h3>

            {contact.isGroup ? (
              <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <Users className="h-4 w-4" />
                <span>
                  مجموعة دردشة · {groupMembers.length || contact.membersCount || 3}{' '}
                  أعضاء
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCopyPhone}
                className="mt-2 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-1.5 font-mono text-sm text-emerald-400 tabular-nums transition-colors hover:border-emerald-500/40 hover:bg-slate-800"
                dir="ltr"
                title="اضغط لنسخ رقم الهاتف"
              >
                <Smartphone className="h-4 w-4" />
                <span>{contact.phone}</span>
                {copiedPhone ? (
                  <Check className="h-4 w-4 text-emerald-300" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                )}
              </button>
            )}

            <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-400">
              <span>
                {contact.isBlocked
                  ? 'محظور حالياً'
                  : contact.isGroup
                  ? 'مجموعة نشطة الآن'
                  : contact.isOnline
                  ? 'متصل الآن'
                  : contact.statusText}
              </span>
              {contact.isMuted && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-400">
                    {contact.mutedUntilText || 'مكتوم الإشعارات'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Actions: Mute & Wallpaper & Block */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={contact.isMuted ? onUnmuteQuick : onOpenMuteModal}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-semibold transition-colors ${
                contact.isMuted
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              {contact.isMuted ? (
                <Bell className="h-5 w-5 text-amber-400" />
              ) : (
                <BellOff className="h-5 w-5 text-slate-400" />
              )}
              <span className="whitespace-nowrap">
                {contact.isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenWallpaperStudio}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
            >
              <Palette className="h-5 w-5 text-emerald-400" />
              <span className="whitespace-nowrap">خلفية الشات</span>
            </button>

            <button
              type="button"
              onClick={onOpenBlockModal}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-semibold transition-colors ${
                contact.isBlocked
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
              }`}
            >
              {contact.isBlocked ? (
                <Unlock className="h-5 w-5 text-emerald-400" />
              ) : (
                <Ban className="h-5 w-5 text-rose-400" />
              )}
              <span className="whitespace-nowrap">
                {contact.isBlocked
                  ? 'فك الحظر'
                  : contact.isGroup
                  ? 'تعطيل المجموعة'
                  : 'حظر الرقم'}
              </span>
            </button>
          </div>

          {/* Bio / About */}
          <div className="border-t border-slate-800/80 pt-5">
            <div className="mb-1.5 text-xs font-semibold text-slate-400">
              {contact.isGroup ? 'وصف المجموعة' : 'النبذة التعريفية'}
            </div>
            <p className="text-sm leading-relaxed text-slate-200">{contact.bio}</p>
          </div>

          {/* Group Members Section (Only for Group Chats) */}
          {contact.isGroup && (
            <div className="border-t border-slate-800/80 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Users className="h-4 w-4 text-emerald-400" />
                  <span>أعضاء المجموعة ({groupMembers.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddMemberBox((prev) => !prev)}
                  className="flex items-center gap-1 rounded-xl bg-emerald-600/20 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-600/30"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>إضافة عضو</span>
                </button>
              </div>

              {showAddMemberBox && (
                <div className="mb-4 space-y-3 rounded-2xl border border-slate-800 bg-slate-950 p-3.5">
                  {nonGroupContactsNotYetInGroup.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-semibold text-slate-400">
                        إضافة سريعة من جهات اتصالك:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {nonGroupContactsNotYetInGroup.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              onAddGroupMember?.(contact.id, {
                                id: c.id,
                                name: c.name,
                                phone: c.phone,
                                avatarFallbackColor:
                                  c.avatarFallbackColor || 'bg-cyan-600',
                                role: 'member',
                              });
                            }}
                            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:border-emerald-500/40"
                          >
                            <UserPlus className="h-3 w-3" />
                            <span>{c.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold text-slate-400">
                      أو إضافة عضو برقم الهاتف:
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="اسم العضو الجديد"
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          dir="ltr"
                          value={newMemberPhone}
                          onChange={(e) => setNewMemberPhone(e.target.value)}
                          placeholder="01012345678"
                          className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-xs text-white tabular-nums focus:border-emerald-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newMemberName.trim() || !newMemberPhone.trim())
                              return;
                            onAddGroupMember?.(contact.id, {
                              id: `gm-${Date.now()}`,
                              name: newMemberName.trim(),
                              phone: newMemberPhone.trim(),
                              avatarFallbackColor: 'bg-teal-600',
                              role: 'member',
                            });
                            setNewMemberName('');
                            setNewMemberPhone('');
                            setShowAddMemberBox(false);
                          }}
                          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                        >
                          إضافة
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {groupMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${member.avatarFallbackColor}`}
                      >
                        {member.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-white">
                          {member.name}
                        </div>
                        <div
                          dir="ltr"
                          className="font-mono text-[11px] text-emerald-400 tabular-nums"
                        >
                          {member.phone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-slate-400">
                        {member.role === 'admin' ? 'مشرف' : 'عضو'}
                      </span>
                      {member.role !== 'admin' && onRemoveGroupMember && (
                        <button
                          type="button"
                          onClick={() =>
                            onRemoveGroupMember(contact.id, member.id)
                          }
                          className="rounded-lg p-1 text-rose-400 hover:bg-rose-950/40"
                          title="إزالة من المجموعة"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Wallpaper Status */}
          <div className="border-t border-slate-800/80 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-200">
                  خلفية المحادثة المتحركة
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {currentTheme
                    ? `مخصصة: ${currentTheme.name}`
                    : 'الخلفية العامة الافتراضية'}
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenWallpaperStudio}
                className="rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-slate-700 whitespace-nowrap shrink-0"
              >
                تغيير الخلفية
              </button>
            </div>
          </div>

          {/* Disappearing Messages */}
          <div className="border-t border-slate-800/80 pt-5">
            <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span>الرسائل ذاتية الاختفاء</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-950 p-1.5">
              {(
                [
                  { id: 'off', label: 'إيقاف' },
                  { id: '24h', label: '24 ساعة' },
                  { id: '7d', label: '7 أيام' },
                  { id: '90d', label: '90 يوم' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onToggleDisappearing(opt.id)}
                  className={`rounded-lg py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    contact.disappearingMessages === opt.id
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Shared Media, Files & Links */}
          <div className="border-t border-slate-800/80 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">
                الوسائط والملفات والروابط
              </span>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {(contact.sharedMedia || []).length}
              </span>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-950 p-1.5">
              <button
                type="button"
                onClick={() => setMediaTab('image')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
                  mediaTab === 'image'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>صور</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaTab('file')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
                  mediaTab === 'file'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>ملفات</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaTab('link')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
                  mediaTab === 'link'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Link2 className="h-3.5 w-3.5" />
                <span>روابط</span>
              </button>
            </div>

            {filteredMedia.length === 0 ? (
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 py-6 text-center text-xs text-slate-500">
                لا توجد عناصر مشاركة في هذا القسم حتى الآن
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredMedia.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-800/70 bg-slate-950/50 p-3"
                  >
                    {item.type === 'image' && item.url ? (
                      <img
                        src={item.url}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-emerald-400">
                        {item.type === 'file' ? (
                          <FileText className="h-5 w-5" />
                        ) : (
                          <Link2 className="h-5 w-5" />
                        )}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-slate-200">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-400">{item.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Starred Messages in this chat */}
          {starredMessages.length > 0 && (
            <div className="border-t border-slate-800/80 pt-5">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-amber-400">
                <Star className="h-4 w-4 fill-amber-400" />
                <span>الرسائل المميزة بنجمة ({starredMessages.length})</span>
              </div>
              <div className="space-y-2">
                {starredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-slate-300"
                  >
                    <p className="line-clamp-2">{msg.text}</p>
                    <span className="mt-1 block font-mono text-[10px] text-slate-500 tabular-nums">
                      {msg.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Encryption Note */}
          <div className="border-t border-slate-800/80 pt-5">
            <div className="flex items-start gap-3 rounded-xl bg-slate-950/60 p-3.5 text-xs text-slate-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <span className="font-semibold text-slate-200">
                  التشفير التام بين الطرفين
                </span>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  {contact.isGroup
                    ? `جميع رسائل ومرفقات "${contact.name}" مشفرة بين أعضاء المجموعة.`
                    : `الرسائل والمكالمات مع الرقم ${contact.phone} مؤمّنة بتشفير تام.`}
                </p>
              </div>
            </div>
          </div>

          {/* Danger Zone: Clear & Block */}
          <div className="space-y-2.5 border-t border-slate-800/80 pt-5">
            <button
              type="button"
              onClick={onClearChat}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <Trash2 className="h-4 w-4 text-slate-400" />
              <span>مسح محتوى الدردشة</span>
            </button>

            <button
              type="button"
              onClick={onOpenBlockModal}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-semibold transition-colors ${
                contact.isBlocked
                  ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              {contact.isBlocked ? (
                <>
                  <Unlock className="h-4 w-4" />
                  <span>إلغاء حظر {contact.name}</span>
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4" />
                  <span>
                    {contact.isGroup
                      ? `مغادرة أو حظر ${contact.name}`
                      : `حظر ${contact.name}`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
