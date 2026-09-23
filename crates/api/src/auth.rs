use axum::extract::{FromRef, FromRequestParts};
use axum::http::request::Parts;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user id as string (UUID)
    pub exp: usize,
}

pub fn validate_secret(secret: &str) -> anyhow::Result<()> {
    anyhow::ensure!(
        secret.trim().len() >= 32,
        "JWT_SECRET must contain at least 32 bytes; generate a random secret before starting the API"
    );
    Ok(())
}

pub fn create_token(user_id: Uuid, secret: &str, expires_in_secs: i64) -> Result<String, AppError> {
    let exp = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::seconds(expires_in_secs))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        exp,
    };
    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|_| AppError::Other(anyhow::anyhow!("token creation failed")))
}

pub fn verify_token(token: &str, secret: &str) -> Result<Claims, AppError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map(|data| data.claims)
    .map_err(|_| AppError::Unauthorized)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "test-only-strong-secret-with-at-least-32-bytes";

    #[test]
    fn rejects_empty_short_and_default_secrets() {
        for secret in [
            "",
            "short",
            "change-me-in-production",
            "dev-secret-change-in-production",
            "                                ",
        ] {
            assert!(validate_secret(secret).is_err());
        }
        assert!(validate_secret(SECRET).is_ok());
    }

    #[test]
    fn accepts_valid_tokens_and_rejects_wrong_keys() {
        let user_id = Uuid::new_v4();
        let token = create_token(user_id, SECRET, 60).unwrap();
        assert_eq!(
            verify_token(&token, SECRET).unwrap().sub,
            user_id.to_string()
        );
        assert!(verify_token(&token, "different-secret").is_err());
    }

    #[test]
    fn rejects_expired_tokens_and_unexpected_algorithms() {
        let user_id = Uuid::new_v4();
        let expired = create_token(user_id, SECRET, -120).unwrap();
        assert!(verify_token(&expired, SECRET).is_err());
        let claims = Claims {
            sub: user_id.to_string(),
            exp: usize::MAX,
        };
        let wrong_algorithm = encode(
            &Header::new(Algorithm::HS512),
            &claims,
            &EncodingKey::from_secret(SECRET.as_bytes()),
        )
        .unwrap();
        assert!(verify_token(&wrong_algorithm, SECRET).is_err());
    }
}

pub struct AuthUser {
    pub user_id: Uuid,
}

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
    AppState: axum::extract::FromRef<S>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);

        let auth_header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(AppError::Unauthorized)?;

        let claims = verify_token(token, &app_state.jwt_secret)?;
        let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;
        Ok(AuthUser { user_id })
    }
}
