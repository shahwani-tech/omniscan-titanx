/**
 * OMNISCAN TITAN X - Safe Server-Side Discord Integration
 * Operates purely on the Node.js backend.
 * Never exposes bot tokens or channel secrets to the client/browser bundle.
 */

import { loadStoredSecurityData } from "./storage";

interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  timestamp: string;
  fields: DiscordEmbedField[];
  footer?: { text: string };
}

export const DISCORD_COLORS = {
  INFO: 0x0284c7, // Sky Blue
  SUCCESS: 0x10b981, // Emerald Green
  WARNING: 0xf59e0b, // Amber
  DANGER: 0xef4444, // Red
  LOCKDOWN: 0x7f1d1d, // Dark Crimson
};

export async function sendDiscordEmbed(
  title: string,
  description: string,
  color: number,
  fields: DiscordEmbedField[] = []
): Promise<{ success: boolean; message: string }> {
  const data = loadStoredSecurityData();
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID || data.discord.channelId;

  if (!token || !channelId) {
    return {
      success: false,
      message: "Discord integration is not configured with DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID in server environment.",
    };
  }

  const embed: DiscordEmbed = {
    title: `🛡️ [OmniScan Titan X] ${title}`,
    description,
    color,
    timestamp: new Date().toISOString(),
    fields: [
      { name: "App Name", value: data.branding.applicationName, inline: true },
      { name: "Installation ID", value: `\`${data.installation.installationId}\``, inline: true },
      ...fields,
    ],
    footer: {
      text: "OmniScan Security Management Architecture • Authorized Notification",
    },
  };

  try {
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "OmniScanTitanX-Security/2.5.0",
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        message: `Discord API responded with status ${response.status}: ${errText.slice(0, 150)}`,
      };
    }

    return {
      success: true,
      message: "Discord alert dispatched successfully.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to connect to Discord endpoint: ${err.message || "Network error"}`,
    };
  }
}

export async function dispatchDiscordSecurityNotification(
  type: "registration" | "expiring_soon" | "expired" | "lockdown" | "failed_login" | "rename",
  extraDetails: Record<string, string> = {}
): Promise<void> {
  const data = loadStoredSecurityData();
  if (!data.discord.enabled && type !== "lockdown") {
    return;
  }

  const fields: DiscordEmbedField[] = Object.entries(extraDetails).map(([k, v]) => ({
    name: k,
    value: v,
    inline: true,
  }));

  switch (type) {
    case "registration":
      if (!data.discord.notifyOnRegistration) return;
      await sendDiscordEmbed(
        "New Installation Registered",
        "A new workstation installation has been provisioned and registered in the security directory.",
        DISCORD_COLORS.SUCCESS,
        fields
      );
      break;

    case "expiring_soon":
      if (!data.discord.notifyOnExpiringSoon) return;
      await sendDiscordEmbed(
        "License Expiring Soon Warning",
        "Workstation license duration is approaching expiration deadline. Action required to extend.",
        DISCORD_COLORS.WARNING,
        fields
      );
      break;

    case "expired":
      if (!data.discord.notifyOnExpired) return;
      await sendDiscordEmbed(
        "License Expired - Workstation Inactive",
        "License timeframe elapsed. Application functionality has transitioned into restricted locked state.",
        DISCORD_COLORS.DANGER,
        fields
      );
      break;

    case "lockdown":
      if (!data.discord.notifyOnLockdown) return;
      await sendDiscordEmbed(
        "CRITICAL: Application Locked",
        "Immediate administrator lockdown or severe tamper detection triggered. Workstation fully sealed.",
        DISCORD_COLORS.LOCKDOWN,
        fields
      );
      break;

    case "failed_login":
      if (!data.discord.notifyOnFailedLogins) return;
      await sendDiscordEmbed(
        "SECURITY ALERT: Repeated Failed Super Admin Logins",
        "Multiple unauthorized access attempts detected on hidden Super Admin gateway. Rate-limit lockout engaged.",
        DISCORD_COLORS.DANGER,
        fields
      );
      break;

    case "rename":
      if (!data.discord.notifyOnRename) return;
      await sendDiscordEmbed(
        "Workstation Application Renamed",
        "Super Admin has updated the operational brand identity for this installation.",
        DISCORD_COLORS.INFO,
        fields
      );
      break;
  }
}
