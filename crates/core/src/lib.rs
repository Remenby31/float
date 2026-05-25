use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskWeight {
    Light,
    Medium,
    Heavy,
}

impl std::fmt::Display for TaskWeight {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaskWeight::Light => write!(f, "light"),
            TaskWeight::Medium => write!(f, "medium"),
            TaskWeight::Heavy => write!(f, "heavy"),
        }
    }
}

impl std::str::FromStr for TaskWeight {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "light" => Ok(TaskWeight::Light),
            "medium" => Ok(TaskWeight::Medium),
            "heavy" => Ok(TaskWeight::Heavy),
            _ => Err(format!("invalid weight: {s}")),
        }
    }
}
