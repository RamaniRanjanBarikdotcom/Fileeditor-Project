'use client';

import { useCallback, useEffect, useState } from 'react';
import { Image as ImageIcon, Star, Trash2 } from 'lucide-react';
import { fetchApi } from '../../../../lib/api';

type StudioImage = {
  id: string;
  blogId: string;
  url: string;
  prompt: string;
  altText?: string;
  isFeatured: boolean;
  width: number;
  height: number;
  createdAt: string;
  blog?: { title: string };
};

export default function ImagesPage() {
  const [images, setImages] = useState<StudioImage[]>([]);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const result = await fetchApi<StudioImage[]>('/blog-studio/images');
    if (result.success && result.data) setImages(result.data);
    else setMessage(result.error?.message || 'Images could not be loaded.');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function feature(image: StudioImage) {
    const result = await fetchApi(
      `/blog-studio/blogs/${image.blogId}/images/${image.id}/featured`,
      { method: 'POST' },
    );
    setMessage(
      result.success ? 'Featured image updated.' : result.error?.message || 'Update failed.',
    );
    await load();
  }

  async function remove(image: StudioImage) {
    const result = await fetchApi(
      `/blog-studio/blogs/${image.blogId}/images/${image.id}`,
      { method: 'DELETE' },
    );
    setMessage(result.success ? 'Image deleted.' : result.error?.message || 'Delete failed.');
    await load();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-indigo-500">
          <ImageIcon className="h-4 w-4" /> Media gallery
        </span>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
          Generated article images
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Assets are stored privately and opened with short-lived signed links.
        </p>
      </header>
      {message && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
          {message}
        </div>
      )}
      {!images.length ? (
        <section className="rounded-2xl border border-dashed border-slate-300 p-16 text-center dark:border-slate-700">
          <ImageIcon className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="mt-4 font-bold text-slate-950 dark:text-white">No generated images yet</h2>
          <p className="mt-2 text-sm text-slate-500">Open an article and generate its first cover image.</p>
        </section>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((image) => (
            <article key={image.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <a href={image.url} target="_blank" rel="noreferrer">
                <img src={image.url} alt={image.altText || image.prompt} className="aspect-video w-full object-cover" />
              </a>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{image.blog?.title || 'Article image'}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{image.prompt}</p>
                  </div>
                  {image.isFeatured && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-400">{image.width} × {image.height}</span>
                  <div className="flex gap-2">
                    <button onClick={() => feature(image)} className="text-xs font-bold text-indigo-600">Feature</button>
                    <button onClick={() => remove(image)} aria-label="Delete image" className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
