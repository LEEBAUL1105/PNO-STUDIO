import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

/**
 * Validate connection to Firestore as per critical constraints.
 */
async function testConnection() {
  try {
    // Try to get a dummy doc to check connection
    await getDocFromServer(doc(db, '_connection_test_', 'check'));
    console.log('Firebase connection successful');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. Client is offline.");
    }
    // Note: Permission denied is expected for this dummy doc and counts as 'connected'
  }
}

testConnection();
