import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { Observable, filter, map } from 'rxjs';
import { environment } from '@fuse/environments/environment';

export type UploadImageResponse = {
    key: string;
    publicUrl: string;
};

export type UploadImageProgress =
    | { type: 'progress'; progress: number }          // 0-100
    | { type: 'done'; data: UploadImageResponse };

@Injectable({ providedIn: 'root' })
export class ImageUploadService {
    // If you already use environment.apiUrl, replace with that:
    // private readonly baseUrl = environment.apiUrl;
    private readonly baseUrl = `${environment.apiUrl}`;

    constructor(private http: HttpClient) { }

    /**
     * Upload image and get { key, publicUrl }.
     * Endpoint: POST /api/files/upload-image?folder=...
     * Form field name MUST be "file" (matches IFormFile file).
     */
    uploadImage(
        file: File,
        folder?: string,
        subfolder?: string
    ): Observable<UploadImageResponse> {

        const form = new FormData();
        form.append('file', file, file.name);

        let params = new HttpParams();

        const cleanFolder = folder?.trim();
        const cleanSubfolder = subfolder?.trim();

        if (cleanFolder) {
            const fullFolder = cleanSubfolder
                ? `${cleanFolder}/${cleanSubfolder}`
                : cleanFolder;

            params = params.set('folder', fullFolder);
        }

        return this.http.post<UploadImageResponse>(
            `${this.baseUrl}/files/upload-image`,
            form,
            { params }
        );
    }


    /**
     * Upload with progress updates (useful for UI progress bar).
     */
    uploadImageWithProgress(file: File, folder?: string): Observable<UploadImageProgress> {
        const form = new FormData();
        form.append('file', file, file.name);

        let params = new HttpParams();
        if (folder) params = params.set('folder', folder);

        return this.http.post<UploadImageResponse>(`${this.baseUrl}/files/upload-image`, form, {
            params,
            observe: 'events',
            reportProgress: true,
        }).pipe(
            map((event: HttpEvent<UploadImageResponse>) => {
                if (event.type === HttpEventType.UploadProgress) {
                    const total = event.total ?? 0;
                    const progress = total > 0 ? Math.round((event.loaded / total) * 100) : 0;
                    return { type: 'progress', progress } as UploadImageProgress;
                }

                if (event.type === HttpEventType.Response) {
                    return { type: 'done', data: event.body as UploadImageResponse } as UploadImageProgress;
                }

                // ignore other events
                return null as any;
            }),
            filter(Boolean)
        );
    }
}
