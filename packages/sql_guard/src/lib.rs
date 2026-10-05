//! Classifies dangerous data-definition statements in a SQL migration.
//!
//! Hazard labels come from this crate. The language model only explains them.

mod split;

pub use split::{split_statements, ParseError, ParsedStatement};
