import { NextRequest, NextResponse } from "next/server";
import { executeCommand, VehicleCommand } from "@/services/genesis";
import { GmailService } from "@/services/gmail";

const VALID_COMMANDS: VehicleCommand[] = [
  "start",
  "start-winter",
  "start-summer",
  "stop",
  "lock",
  "unlock",
  "status",
];

export async function POST(request: NextRequest) {
  // Authenticate with API key
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: { command?: string; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const command = body.command?.toLowerCase() as VehicleCommand;
  const pin = body.pin || "";

  if (!command || !VALID_COMMANDS.includes(command)) {
    return NextResponse.json(
      { error: `Invalid command. Use: ${VALID_COMMANDS.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate PIN
  if (pin !== process.env.COMMAND_PIN) {
    console.warn(`Rejected command: invalid PIN from API`);
    return NextResponse.json({ error: "Invalid PIN" }, { status: 403 });
  }

  // Execute
  console.log(`Executing command: ${command}`);
  const result = await executeCommand(command);
  console.log(
    `Command result: ${result.success ? "success" : "failed"} - ${result.message}`
  );

  // Send SMS confirmation if gateway is configured
  if (process.env.SMS_GATEWAY && process.env.GMAIL_APP_PASSWORD) {
    try {
      const gmail = new GmailService();
      await gmail.sendSms(result.message);
    } catch {
      // SMS confirmation is best-effort
    }
  }

  const status = result.success ? 200 : 502;
  return NextResponse.json(
    { success: result.success, message: result.message },
    { status }
  );
}
