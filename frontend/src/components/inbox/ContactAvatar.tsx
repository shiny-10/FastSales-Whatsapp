"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ContactAvatarProps {
  name?: string | null;
  phone: string;
  className?: string;
}

export function ContactAvatar({ name, phone, className }: ContactAvatarProps) {
  const displayName = name ?? undefined;
  const seed = encodeURIComponent(displayName || phone);
  const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=0ea5e9,8b5cf6,ec4899,f97316,10b981&backgroundType=gradientLinear&fontSize=38&fontWeight=600`;

  return (
    <Avatar className={cn(className)}>
      <AvatarImage src={avatarUrl} alt={displayName || phone} />
      <AvatarFallback>{getInitials(displayName, phone)}</AvatarFallback>
    </Avatar>
  );
}
