use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ShellType {
    Bash,
    Zsh,
    Fish,
    Sh,
    Tcsh,
    Ksh,
}

impl ShellType {
    pub fn as_str(&self) -> &str {
        match self {
            ShellType::Bash => "bash",
            ShellType::Zsh => "zsh",
            ShellType::Fish => "fish",
            ShellType::Sh => "sh",
            ShellType::Tcsh => "tcsh",
            ShellType::Ksh => "ksh",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "bash" => Some(ShellType::Bash),
            "zsh" => Some(ShellType::Zsh),
            "fish" => Some(ShellType::Fish),
            "sh" => Some(ShellType::Sh),
            "tcsh" => Some(ShellType::Tcsh),
            "ksh" => Some(ShellType::Ksh),
            _ => None,
        }
    }
}

impl fmt::Display for ShellType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}
