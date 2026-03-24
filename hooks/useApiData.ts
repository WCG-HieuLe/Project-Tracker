import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheGet, cacheSet, cacheClear } from '../services/apiCache';

interface UseApiDataOptions<T> {
    /** Cache key, ví dụ: 'projects_general', 'product_members' */
    key: string;
    /** Hàm async trả về data */
    fetcher: () => Promise<T>;
    /** Cache TTL in ms (default: 10 phút) */
    ttl?: number;
    /** Chỉ fetch khi true (default: true) */
    enabled?: boolean;
    /** Data mặc định khi chưa có cache */
    initialData?: T;
}

interface UseApiDataResult<T> {
    data: T;
    loading: boolean;      // true = lần đầu load (chưa có cache)
    refreshing: boolean;   // true = đang refresh ngầm (đã có data cũ hiện trên UI)
    error: string | null;
    refresh: () => void;   // gọi khi user bấm nút Refresh
    isStale: boolean;      // data từ cache, đang fetch bản mới
}

export function useApiData<T>(options: UseApiDataOptions<T>): UseApiDataResult<T> {
    const {
        key,
        fetcher,
        ttl = 10 * 60 * 1000,
        enabled = true,
        initialData,
    } = options;

    const cached = cacheGet<T>(key, ttl);
    const [data, setData] = useState<T>(cached ?? initialData as T);
    const [loading, setLoading] = useState(!cached);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isStale, setIsStale] = useState(!!cached);
    const mountedRef = useRef(true);
    const fetchedRef = useRef(!!cached);

    const doFetch = useCallback(async (force = false) => {
        if (!enabled) return;

        if (force) {
            cacheClear(key);
            setRefreshing(true);
        } else if (fetchedRef.current) {
            return;
        } else if (cacheGet(key, ttl)) {
            setIsStale(true);
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError(null);

        try {
            const result = await fetcher();
            if (!mountedRef.current) return;
            setData(result);
            cacheSet(key, result);
            fetchedRef.current = true;
            setIsStale(false);
        } catch (err) {
            if (!mountedRef.current) return;
            const msg = err instanceof Error ? err.message : 'Fetch failed';
            setError(msg);
            console.error(`[useApiData:${key}]`, err);
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [key, fetcher, ttl, enabled]);

    useEffect(() => {
        mountedRef.current = true;
        doFetch();
        return () => { mountedRef.current = false; };
    }, [doFetch]);

    const refresh = useCallback(() => doFetch(true), [doFetch]);

    return { data, loading, refreshing, error, refresh, isStale };
}
