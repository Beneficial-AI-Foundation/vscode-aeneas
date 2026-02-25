# TODO

## Spec file generation

- Guarantee that the generated file is valid Lean code (currently the boilerplate may not parse if the namespace or theorem name contains unexpected characters)
- Produce sensible names from Rust names that contain `::{` (e.g., trait impl blocks like `<Type as Trait>::method`) — these need special handling to generate valid Lean identifiers and file paths
- Auto-extract function args from the Lean definition for generated spec files
