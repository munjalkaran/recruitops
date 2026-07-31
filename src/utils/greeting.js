import { ROLE_LABELS } from "../constants/pipeline";

const getDisplayName = (profile) => {
  const fullName = String(profile?.full_name || "").trim();
  if (fullName) return fullName.split(/\s+/)[0];
  return ROLE_LABELS[profile?.role] || profile?.role || "there";
};

export const getTimeAwareGreeting = (profile, date = new Date()) => {
  const hour = date.getHours();
  const firstName = getDisplayName(profile);

  if (hour >= 5 && hour < 12) return `Good morning, ${firstName}. Ready for the day?`;
  if (hour >= 12 && hour < 17) return `Good afternoon, ${firstName}. Here’s what needs attention.`;
  if (hour >= 17 && hour < 22) return `Good evening, ${firstName}. Let’s close the day well.`;
  return `Working late, ${firstName}? Let’s keep it focused.`;
};
