// FILE: web/src/ai/tools.ts

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export const ACTION_BRIDGE_TOOLS: { functionDeclarations: GeminiFunctionDeclaration[] } = {
  functionDeclarations: [
    {
      name: 'open_app',
      description: 'Launch an installed Android application by name (e.g. "chrome", "whatsapp", "camera", "spotify", "settings").',
      parameters: {
        type: 'OBJECT',
        properties: {
          app_name: {
            type: 'STRING',
            description: 'The common name or package identifier of the app to launch.',
          },
        },
        required: ['app_name'],
      },
    },
    {
      name: 'set_alarm',
      description: 'Configure and set a device alarm for a specific hour and minute with an optional label.',
      parameters: {
        type: 'OBJECT',
        properties: {
          hour: {
            type: 'INTEGER',
            description: 'Hour of the day in 24-hour format (0-23).',
          },
          minutes: {
            type: 'INTEGER',
            description: 'Minute of the hour (0-59).',
          },
          message: {
            type: 'STRING',
            description: 'Optional alarm label or reminder note.',
          },
        },
        required: ['hour', 'minutes'],
      },
    },
    {
      name: 'set_timer',
      description: 'Set a countdown timer on the Android device.',
      parameters: {
        type: 'OBJECT',
        properties: {
          seconds: {
            type: 'INTEGER',
            description: 'Duration of timer in seconds.',
          },
          message: {
            type: 'STRING',
            description: 'Optional timer label.',
          },
        },
        required: ['seconds'],
      },
    },
    {
      name: 'set_torch',
      description: 'Turn the device camera flashlight / torch on or off.',
      parameters: {
        type: 'OBJECT',
        properties: {
          state: {
            type: 'BOOLEAN',
            description: 'True to activate flashlight, False to turn it off.',
          },
        },
        required: ['state'],
      },
    },
    {
      name: 'set_volume',
      description: 'Adjust the volume level of a specific audio stream on the device.',
      parameters: {
        type: 'OBJECT',
        properties: {
          stream: {
            type: 'STRING',
            description: 'Target audio stream: "media", "ring", "alarm", "notification", or "voice".',
            enum: ['media', 'ring', 'alarm', 'notification', 'voice'],
          },
          level: {
            type: 'INTEGER',
            description: 'Desired volume percentage from 0 to 100.',
          },
        },
        required: ['stream', 'level'],
      },
    },
    {
      name: 'prepare_sms',
      description: 'Open the default SMS app with pre-filled recipient and text message.',
      parameters: {
        type: 'OBJECT',
        properties: {
          phone_number: {
            type: 'STRING',
            description: 'The recipient phone number.',
          },
          message: {
            type: 'STRING',
            description: 'The body text of the SMS message.',
          },
        },
        required: ['phone_number', 'message'],
      },
    },
    {
      name: 'open_whatsapp_to',
      description: 'Open WhatsApp with a prepared chat or pre-filled message.',
      parameters: {
        type: 'OBJECT',
        properties: {
          phone_number: {
            type: 'STRING',
            description: 'Phone number in international format without plus or symbols.',
          },
          message: {
            type: 'STRING',
            description: 'Message draft text.',
          },
        },
        required: ['message'],
      },
    },
    {
      name: 'open_maps',
      description: 'Open Google Maps or map navigation searching for a location, address, or query.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: {
            type: 'STRING',
            description: 'Location, establishment, or search query for maps.',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'web_search',
      description: 'Perform a web search query on the user device.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: {
            type: 'STRING',
            description: 'Search terms to query.',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'take_photo',
      description: 'Open the device camera app to take a photo.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'open_settings',
      description: 'Open a specific Android settings screen.',
      parameters: {
        type: 'OBJECT',
        properties: {
          target: {
            type: 'STRING',
            description: 'Settings sub-screen: "wifi", "bluetooth", "sound", "display", "battery", "apps", "location", or "main".',
            enum: ['wifi', 'bluetooth', 'sound', 'display', 'battery', 'apps', 'location', 'main'],
          },
        },
        required: ['target'],
      },
    },
  ],
};

declare global {
  interface Window {
    SystemBridgeNative?: {
      openApp: (payloadJson: string) => string;
      setAlarm: (payloadJson: string) => string;
      setTimer: (payloadJson: string) => string;
      setTorch: (payloadJson: string) => string;
      setVolume: (payloadJson: string) => string;
      prepareSms: (payloadJson: string) => string;
      openWhatsappTo: (payloadJson: string) => string;
      openMaps: (payloadJson: string) => string;
      webSearch: (payloadJson: string) => string;
      takePhoto: () => string;
      openSettings: (payloadJson: string) => string;
      getRegisteredCapabilities: () => string;
    };
  }
}

/**
 * Executes a tool function request via the native Android SystemBridge
 */
export async function executeNativeToolCall(
  functionName: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const native = window.SystemBridgeNative;
  const payloadStr = JSON.stringify(args || {});

  if (!native) {
    return {
      status: 'simulated',
      message: `Action '${functionName}' called in preview mode with params: ${payloadStr}`,
    };
  }

  try {
    let rawResultStr = '';
    switch (functionName) {
      case 'open_app':
        rawResultStr = native.openApp(payloadStr);
        break;
      case 'set_alarm':
        rawResultStr = native.setAlarm(payloadStr);
        break;
      case 'set_timer':
        rawResultStr = native.setTimer(payloadStr);
        break;
      case 'set_torch':
        rawResultStr = native.setTorch(payloadStr);
        break;
      case 'set_volume':
        rawResultStr = native.setVolume(payloadStr);
        break;
      case 'prepare_sms':
        rawResultStr = native.prepareSms(payloadStr);
        break;
      case 'open_whatsapp_to':
        rawResultStr = native.openWhatsappTo(payloadStr);
        break;
      case 'open_maps':
        rawResultStr = native.openMaps(payloadStr);
        break;
      case 'web_search':
        rawResultStr = native.webSearch(payloadStr);
        break;
      case 'take_photo':
        rawResultStr = native.takePhoto();
        break;
      case 'open_settings':
        rawResultStr = native.openSettings(payloadStr);
        break;
      default:
        return { status: 'error', message: `Unknown tool name: ${functionName}` };
    }

    return JSON.parse(rawResultStr);
  } catch (err: unknown) {
    return {
      status: 'error',
      message: `Failed to execute ${functionName}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
