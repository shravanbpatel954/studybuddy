import { useState, useCallback, useEffect } from 'react';

export default function useSession(initial = {}) {
    const [xp, setXp] = useState(initial.xp || 0);
    const [streak, setStreak] = useState(initial.streak || 0);
    const [consecutiveCorrect, setConsecutiveCorrect] = useState(initial.consecutiveCorrect || 0);
    const [consecutiveWrong, setConsecutiveWrong] = useState(initial.consecutiveWrong || 0);
    const [flashcardQueue, setFlashcardQueue] = useState(initial.flashcardQueue || []);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setUser(null);
                    return;
                }

                const apiBase = process.env.REACT_APP_API_BASE || 'https://studybuddy-backend-i649.onrender.com/api/v1';
                const res = await fetch(`${apiBase}/auth/profile`, {
                    headers: {
                        Authorization: 'Bearer ' + token,
                        'Content-Type': 'application/json',
                    },
                });

                // If the token is invalid/expired, remove it. For other transient errors
                // (5xx, network issues, 404) don't remove the token so a page refresh doesn't
                // immediately log the user out. This makes the behaviour less destructive.
                if (!res.ok) {
                    console.warn('Profile fetch returned non-ok status:', res.status);
                    // Only clear token on authentication errors (401, 403)
                    // Don't clear on 404, 500, etc. as these might be temporary issues
                    if (res.status === 401 || res.status === 403) {
                        // authentication issue: clear token
                        console.info('Token appears invalid/expired, clearing stored token');
                        localStorage.removeItem('token');
                        setUser(null);
                        return;
                    }
                    // For other errors (404, 500, etc.), keep user state but don't set user
                    // This prevents logout on temporary API issues
                    console.warn('Profile fetch failed but keeping session (status:', res.status, ')');
                    return;
                }

                const data = await res.json();
                if (data && data._id) {
                    console.log('User session loaded:', data._id);
                    setUser(data);
                } else {
                    console.warn('Profile fetch returned invalid user payload');
                    // don't aggressively remove token here; just treat as not-logged-in
                    setUser(null);
                }
            } catch (error) {
                // Network or other error - log and keep token intact so the user isn't
                // force-logged-out on transient connectivity issues.
                console.error('Failed to fetch user (network or unexpected error):', error);
                setUser(null);
            }
        };
        fetchUser();
    }, []);

    const addXp = useCallback((amount) => setXp(x => x + amount), []);
    const resetStreak = useCallback(() => setStreak(0), []);
    const incStreak = useCallback(() => setStreak(s => s + 1), []);

    const recordAnswer = useCallback((correct) => {
        if (correct) {
            setConsecutiveCorrect(c => c + 1);
            setConsecutiveWrong(0);
            incStreak();
        } else {
            setConsecutiveWrong(w => w + 1);
            setConsecutiveCorrect(0);
            resetStreak();
        }
    }, [incStreak, resetStreak]);

    return {
        user,
        xp,
        addXp,
        streak,
        resetStreak,
        consecutiveCorrect,
        consecutiveWrong,
        recordAnswer,
        flashcardQueue,
        setFlashcardQueue
    };
}
