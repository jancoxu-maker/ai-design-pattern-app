import { openDB, DBSchema } from 'idb';
import { SavedProject } from '../types';

interface ManualMasterDB extends DBSchema {
  projects: {
    key: string;
    value: SavedProject;
  };
}

let dbInstance: any = null;
let initPromise: Promise<any> | null = null;

const getDB = async () => {
  if (dbInstance) return dbInstance;
  
  if (!initPromise) {
    initPromise = (async () => {
      try {
        dbInstance = await openDB<ManualMasterDB>('manual-master-db', 1, {
          upgrade(db) {
            db.createObjectStore('projects', { keyPath: 'id' });
          },
          blocked() {
            console.warn('IndexedDB open blocked');
          },
          blocking() {
            console.warn('IndexedDB blocking');
          },
          terminated() {
            console.error('IndexedDB terminated');
            dbInstance = null;
            initPromise = null;
          },
        });
        return dbInstance;
      } catch (error) {
        initPromise = null;
        throw error;
      }
    })();
  }
  
  return initPromise;
};

export const saveProjectToDB = async (project: SavedProject) => {
  try {
    let db = await getDB();
    try {
      await db.put('projects', project);
    } catch (err: any) {
      // If the connection is closing or closed, try to reopen once
      if (err.name === 'InvalidStateError' || err.message?.includes('closing')) {
        dbInstance = null;
        db = await getDB();
        await db.put('projects', project);
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error("Failed to save project to IndexedDB", error);
    throw error;
  }
};

export const getProjectsFromDB = async (): Promise<SavedProject[]> => {
  try {
    let db = await getDB();
    let projects;
    try {
      projects = await db.getAll('projects');
    } catch (err: any) {
      if (err.name === 'InvalidStateError' || err.message?.includes('closing')) {
        dbInstance = null;
        db = await getDB();
        projects = await db.getAll('projects');
      } else {
        throw err;
      }
    }
    
    // Migration logic: if DB is empty, check localStorage for legacy data
    if (projects.length === 0) {
       const local = localStorage.getItem('manual_master_projects');
       if (local) {
           try {
               const parsed = JSON.parse(local);
               const list = Object.values(parsed) as SavedProject[];
               for (const p of list) {
                   await db.put('projects', p);
               }
               localStorage.removeItem('manual_master_projects');
               projects = await db.getAll('projects');
           } catch(e) {
               console.error("Migration from localStorage failed", e);
           }
       }
    }
    return projects.sort((a, b) => b.lastModified - a.lastModified);
  } catch (error) {
    console.error("Failed to get projects from IndexedDB", error);
    return [];
  }
};

export const deleteProjectFromDB = async (id: string) => {
  try {
    let db = await getDB();
    try {
      await db.delete('projects', id);
    } catch (err: any) {
      if (err.name === 'InvalidStateError' || err.message?.includes('closing')) {
        dbInstance = null;
        db = await getDB();
        await db.delete('projects', id);
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error("Failed to delete project from IndexedDB", error);
    throw error;
  }
};