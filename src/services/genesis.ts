import BlueLinky from "bluelinky";

export type VehicleCommand = "start" | "start-winter" | "start-summer" | "stop" | "lock" | "unlock" | "status";

export interface CommandResult {
  success: boolean;
  message: string;
}

let clientInstance: InstanceType<typeof BlueLinky> | null = null;
let vehicleInstance: Awaited<ReturnType<InstanceType<typeof BlueLinky>["getVehicle"]>> | null = null;

function getClient(): Promise<InstanceType<typeof BlueLinky>> {
  return new Promise((resolve, reject) => {
    if (clientInstance && vehicleInstance) {
      resolve(clientInstance);
      return;
    }

    const client = new BlueLinky({
      username: process.env.GENESIS_USERNAME!,
      password: process.env.GENESIS_PASSWORD!,
      brand: "hyundai", // bluelinky uses Hyundai API for Genesis vehicles
      region: "US",
      pin: process.env.GENESIS_PIN!,
    });

    client.on("ready", () => {
      clientInstance = client;
      console.log("[Genesis] Connected to Genesis Connected Services");
      resolve(client);
    });

    client.on("error", (err: Error) => {
      console.error("[Genesis] Connection error:", err);
      reject(err);
    });

    // Timeout after 30 seconds
    setTimeout(() => reject(new Error("Genesis connection timeout")), 30000);
  });
}

async function getVehicle() {
  if (vehicleInstance) return vehicleInstance;

  const client = await getClient();
  const vehicles = await client.getVehicles();

  if (vehicles.length === 0) {
    throw new Error("No vehicles found on this account");
  }

  // Use VIN from env if specified, otherwise use first vehicle
  const vin = process.env.GENESIS_VIN;
  if (vin) {
    const found = vehicles.find(
      (v) => v.vehicleConfig.vin.toUpperCase() === vin.toUpperCase()
    );
    if (!found) {
      throw new Error(`Vehicle with VIN ${vin} not found`);
    }
    vehicleInstance = found;
  } else {
    vehicleInstance = vehicles[0];
  }

  console.log("[Genesis] Using vehicle:", vehicleInstance.vehicleConfig.vin);
  return vehicleInstance;
}

export async function executeCommand(
  command: VehicleCommand
): Promise<CommandResult> {
  try {
    const vehicle = await getVehicle();

    switch (command) {
      case "start": {
        await vehicle.start({
          hvac: true,
          duration: 10,
          temperature: 72,
          defrost: false,
          heatedFeatures: false,
          unit: "F",
        });
        return { success: true, message: "GV70 started (72°F)" };
      }
      case "start-winter": {
        await vehicle.start({
          hvac: true,
          duration: 10,
          temperature: 80,
          defrost: true,
          heatedFeatures: 1,
          unit: "F",
          seatClimateSettings: { driverSeat: 8, passengerSeat: 8 },
        });
        return { success: true, message: "GV70 started (winter: 80°F, heated seats, defrost)" };
      }
      case "start-summer": {
        await vehicle.start({
          hvac: true,
          duration: 10,
          temperature: 65,
          defrost: false,
          heatedFeatures: 0,
          unit: "F",
          seatClimateSettings: { driverSeat: 5, passengerSeat: 5 },
        });
        return { success: true, message: "GV70 started (summer: 65°F, cooled seats)" };
      }
      case "stop": {
        await vehicle.stop();
        return { success: true, message: "GV70 remote stop initiated" };
      }
      case "lock": {
        await vehicle.lock();
        return { success: true, message: "GV70 doors locked" };
      }
      case "unlock": {
        await vehicle.unlock();
        return { success: true, message: "GV70 doors unlocked" };
      }
      case "status": {
        const status = await vehicle.status({ refresh: false, parsed: true }) as Record<string, unknown> | null;
        if (!status) {
          return { success: false, message: "Could not retrieve vehicle status" };
        }
        const chassis = status.chassis as { locked?: boolean } | undefined;
        const engine = status.engine as { ignition?: boolean } | undefined;
        const locked = chassis?.locked ? "Locked" : "Unlocked";
        const engineOn = engine?.ignition ? "Running" : "Off";
        return {
          success: true,
          message: `GV70: Engine ${engineOn}, Doors ${locked}`,
        };
      }
      default:
        return { success: false, message: `Unknown command: ${command}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Genesis] Command '${command}' failed:`, message);

    // Reset cached instances on auth errors so next attempt reconnects
    if (
      message.includes("auth") ||
      message.includes("login") ||
      message.includes("token")
    ) {
      clientInstance = null;
      vehicleInstance = null;
    }

    return { success: false, message: `Command failed: ${message}` };
  }
}
