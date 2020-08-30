import * as admin from 'firebase-admin';

admin.initializeApp();

const database = admin.firestore();

export { admin, database };