use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const WINDOW: Duration = Duration::from_secs(60);
const MAX_ATTEMPTS: usize = 20;
const MAX_ACCOUNTS: usize = 1024;

#[derive(Default)]
pub struct LoginGuard {
    attempts: Mutex<HashMap<String, (Instant, usize)>>,
}

impl LoginGuard {
    pub fn allow(&self, email: &str) -> bool {
        self.allow_at(email, Instant::now())
    }

    fn allow_at(&self, email: &str, now: Instant) -> bool {
        if email.len() > 254 {
            return false;
        }
        let Ok(mut attempts) = self.attempts.lock() else {
            return false;
        };
        attempts.retain(|_, (started, _)| now.duration_since(*started) < WINDOW);
        let key = email.trim().to_lowercase();
        if !attempts.contains_key(&key) && attempts.len() >= MAX_ACCOUNTS {
            return false;
        }
        let (_, count) = attempts.entry(key).or_insert((now, 0));
        if *count >= MAX_ATTEMPTS {
            return false;
        }
        *count += 1;
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounds_attempts_per_account_and_resets_after_a_minute() {
        let guard = LoginGuard::default();
        let now = Instant::now();
        for _ in 0..MAX_ATTEMPTS {
            assert!(guard.allow_at("user@example.com", now));
        }
        assert!(!guard.allow_at(" USER@EXAMPLE.COM ", now));
        assert!(guard.allow_at("other@example.com", now));
        assert!(guard.allow_at("user@example.com", now + WINDOW));
    }

    #[test]
    fn bounds_memory_used_by_unknown_accounts() {
        let guard = LoginGuard::default();
        let now = Instant::now();
        assert!(!guard.allow_at(&"a".repeat(255), now));
        for index in 0..MAX_ACCOUNTS {
            assert!(guard.allow_at(&format!("{index}@example.com"), now));
        }
        assert!(!guard.allow_at("extra@example.com", now));
        assert!(guard.allow_at("extra@example.com", now + WINDOW));
    }
}
