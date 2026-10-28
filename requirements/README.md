# Dependency locks

`pyproject.toml` declares direct dependencies. `production.txt` pins the tested
runtime resolution; `development.txt` includes that runtime plus pytest, Ruff,
pip-tools, and build tooling. Locks retain the tested Python 3.11 runtime
versions; CI also validates Python 3.12 for Vercel. Root `requirements.txt`
includes the runtime lock and editable project, preserving the existing install
command and guest-cleanup workflow.

Install development dependencies from the repository root:

```powershell
python -m pip install -r requirements/development.txt -e .
```

Regenerate with Python 3.11 and pip-tools, constraining existing pins during a
structural refactor. Review dependency upgrades separately:

```powershell
python -m piptools compile --constraint requirements/production.txt --output-file requirements/production.txt --no-header --no-annotate --no-emit-index-url --no-emit-trusted-host --strip-extras pyproject.toml
python -m piptools compile --extra dev --constraint requirements/production.txt --constraint requirements/development.txt --output-file requirements/development.txt --no-header --no-annotate --no-emit-index-url --no-emit-trusted-host --strip-extras pyproject.toml
```

Review lock diffs and run Ubuntu/Python 3.11 CI after regeneration. Do not copy
an entire developer environment's `pip freeze` into these files. Some current
libraries pull testing packages transitively into the runtime; those declared
requirements remain intact to preserve the tested dependency graph.
