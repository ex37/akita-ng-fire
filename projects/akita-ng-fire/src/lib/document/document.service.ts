import { inject } from '@angular/core';
import {
  AngularFirestore,
  DocumentChangeAction,
  QueryFn,
  QueryGroupFn
} from '@angular/fire/firestore';
import { withTransaction, Store, StoreActions, runStoreAction } from '@datorama/akita';
import { firestore } from 'firebase/app';
import 'firebase/firestore';
import { getIdAndPath } from '../utils/id-or-path';
import { WriteOptions, SyncOptions, PathParams, UpdateCallback, AtomicWrite } from '../utils/types';
import { tap, map, switchMap } from 'rxjs/operators';
import { pathWithParams } from '../utils/path-with-params';
import { DocumentOptions } from './document.config';
import { Observable } from 'rxjs';
import { getStoreName } from '../utils/store-options';
import { setLoading } from '../utils/sync-from-action';


export type DocOptions = { path: string } | { id: string };

type Document = Record<string, any>;
type DocumentState<E extends Document> = {
  doc: E;
  loading: boolean;
};

export class DocumentService<S extends DocumentState<K>, K extends Document> {
  protected db: AngularFirestore;

  protected onCreate?(key: string, value: S, options: WriteOptions): any;
  protected onUpdate?(entity: Partial<S>, options: WriteOptions): any;
  protected onDelete?(id: string, options: WriteOptions): any;

  constructor(
    protected store?: Store<S>,
    db?: AngularFirestore
  ) {
    try {
      this.db = db || inject(AngularFirestore);
    } catch (err) {
      throw new Error('DocumentService requires AngularFirestore.');
    }
  }

  /** The path to the collection in Firestore */
  get path(): string {
    return this.constructor['path'];
  }

  /** A snapshot of the path */
  get currentPath(): string {
    return this.path;
  }

  /**
   * Function triggered when adding/updating data to firestore
   * @note should be overrided
   */
  protected formatToFirestore(entity: Partial<S>): any {
    return entity;
  }

  /** The config given by the `DocumentConfig` */
  public get config(): DocumentOptions {
    return {
      path: this.constructor['path']
    };
  }

  async upsert(key: string, value: Partial<S>, options: WriteOptions = {}) {
    const { write } = options;
    const { ref } = this.db.doc<S>(`${this.currentPath}/${key}`);

    if (write) {
      return (write as firestore.WriteBatch).set(ref, value, { merge: true });
    }
    return ref.set(value, { merge: true });
  }

  async update(key: string, value: Partial<S> | Record<string, firestore.FieldValue>, options: WriteOptions = {}) {
    const { write } = options;
    const { ref } = this.db.doc<S>(`${this.currentPath}/${key}`);

    if (write) {
      return (write as firestore.WriteBatch).update(ref, value);
    }
    return ref.update(value);
  }

  private getPath(options: PathParams) {
    return (options && options.params) ? pathWithParams(this.path, options.params) : this.currentPath;
  }

  // private syncDoc(docOptions: DocOptions) {
  //   const { id, path } = getIdAndPath(docOptions, this.currentPath)

  //   this.store.setLoading(true);
  //   return this.db.doc<K>(path).valueChanges().pipe(
  //     map(value => {
  //       this.store.update({ [id]: value || {} });
  //       this.store.setLoading(false);
  //       return value;
  //     })
  //   );
  // }

  syncDocument(syncOptions?: SyncOptions): Observable<K>;
  syncDocument(path: string, syncOptions?: SyncOptions): Observable<K>;
  syncDocument(pathOrOptions: string | SyncOptions, syncOptions?: SyncOptions) {
    let path: string;
    if (typeof pathOrOptions === 'string') {
      path = pathOrOptions;
    } else {
      syncOptions = pathOrOptions;
      path = this.getPath(syncOptions);
    }

    const storeName = getStoreName(this.store, syncOptions);

    if (syncOptions?.loading) setLoading(storeName, true);
    return this.db.doc<K>(path).valueChanges().pipe(
      map(value => {
        const data = { doc: value || {} } as Partial<S>;
        runStoreAction<S>(storeName, StoreActions.Update, { payload: { data } });
        if (syncOptions?.loading) setLoading(storeName, false);
        return value;
      })
    );
  }
}
