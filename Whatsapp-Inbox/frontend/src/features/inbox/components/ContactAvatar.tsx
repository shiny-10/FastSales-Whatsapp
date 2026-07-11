"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/avatar";
import { getInitials } from "@/shared/lib/utils";
import { cn } from "@/shared/lib/utils";

interface ContactAvatarProps {
  name?: string | null;
  phone: string;
  className?: string;
}

export function ContactAvatar({ name, phone, className }: ContactAvatarProps) {
  const seed = encodeURIComponent(name || phone);
  const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=0ea5e9,8b5cf6,ec4899,f97316,10b981&backgroundType=gradientLinear&fontSize=38&fontWeight=600`;

  return (
    <Avatar className={cn(className)}>
      <AvatarImage src={avatarUrl} alt={name || phone} />
      <AvatarFallback>{getInitials(name || undefined, phone)}</AvatarFallback>
    </Avatar>
  );
}
