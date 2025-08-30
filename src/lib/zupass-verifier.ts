/**
 * ZuPass Verification Worker
 * Runs ZK proof verification in an isolated process to prevent hanging
 */

import { ZKEdDSAEventTicketPCDPackage } from '@pcd/zk-eddsa-event-ticket-pcd';
import path from 'path';

// Initialize the package
async function init() {
  const artifactsPath = path.join(
    process.cwd(),
    'node_modules/@pcd/zk-eddsa-event-ticket-pcd/artifacts'
  );
  
  await ZKEdDSAEventTicketPCDPackage.init?.({
    wasmFilePath: path.join(artifactsPath, 'circuit.wasm'),
    zkeyFilePath: path.join(artifactsPath, 'circuit.zkey')
  });
}

// Verify the PCD
export async function verifyPCD(serializedPCD: string): Promise<boolean> {
  try {
    await init();
    const pcd = await ZKEdDSAEventTicketPCDPackage.deserialize(serializedPCD);
    const result = await ZKEdDSAEventTicketPCDPackage.verify(pcd);
    
    // Clean up workers
    if ((globalThis as any).curve_bn128?.terminate) {
      await (globalThis as any).curve_bn128.terminate();
    }
    
    return result;
  } catch (error) {
    console.error('Verification error in worker:', error);
    return false;
  }
}

// If called directly as a worker script
if (require.main === module) {
  const serializedPCD = process.argv[2];
  if (!serializedPCD) {
    console.error('No PCD provided');
    process.exit(1);
  }
  
  verifyPCD(serializedPCD)
    .then(result => {
      console.log(JSON.stringify({ success: true, valid: result }));
      process.exit(0);
    })
    .catch(error => {
      console.error(JSON.stringify({ success: false, error: error.message }));
      process.exit(1);
    });
}