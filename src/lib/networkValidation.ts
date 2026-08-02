export interface NetworkValidationResult {
  isValid: boolean;
  detectedNetwork: "MTN" | "TELECEL" | "AT" | "UNKNOWN";
  message?: string;
}

export function detectNetworkFromPhone(phone: string): "MTN" | "TELECEL" | "AT" | "UNKNOWN" {
  const clean = phone.replace(/\D/g, "");
  let num = clean;
  if (num.startsWith("233")) {
    num = "0" + num.slice(3);
  }
  if (!num.startsWith("0") || num.length < 3) {
    return "UNKNOWN";
  }

  const prefix3 = num.slice(0, 3);

  const mtnPrefixes = ["024", "054", "055", "059", "025", "053"];
  const telecelPrefixes = ["020", "050"];
  const atPrefixes = ["026", "056", "027", "057"];

  if (mtnPrefixes.includes(prefix3)) return "MTN";
  if (telecelPrefixes.includes(prefix3)) return "TELECEL";
  if (atPrefixes.includes(prefix3)) return "AT";

  return "UNKNOWN";
}

export function validatePhoneForNetwork(
  phone: string,
  selectedNetworkCode: string
): NetworkValidationResult {
  const detected = detectNetworkFromPhone(phone);
  if (detected === "UNKNOWN") {
    return { isValid: true, detectedNetwork: "UNKNOWN" };
  }

  const targetNet = selectedNetworkCode.toUpperCase();
  let expectedCode = "MTN";
  if (targetNet.includes("TELECEL") || targetNet.includes("VODA")) expectedCode = "TELECEL";
  if (targetNet.includes("AIRTEL") || targetNet.includes("TIGO") || targetNet === "AT") expectedCode = "AT";
  if (targetNet.includes("MTN") || targetNet.includes("YELLO")) expectedCode = "MTN";

  // Result Checkers & Bills allow any phone
  if (targetNet.includes("CHECKER") || targetNet.includes("WAEC") || targetNet.includes("BILL")) {
    return { isValid: true, detectedNetwork: detected };
  }

  if (detected !== expectedCode) {
    return {
      isValid: false,
      detectedNetwork: detected,
      message: `The entered phone number belongs to ${detected}, but you selected ${expectedCode}. Please verify the network to prevent order failure.`,
    };
  }

  return { isValid: true, detectedNetwork: detected };
}
