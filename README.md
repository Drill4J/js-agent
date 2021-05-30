# Drill4J - JS agent

> Refer to [Development Guide](DEVELOPMENT.md) for dev/build instructions

"JS agent" is an application that:

1. notifies [Admin Backend](https://github.com/Drill4J/admin) about agent registration / new build deployment events

   - registration/new build data is coming from [JS AST Parser CLI](https://github.com/Drill4J/js-ast-parser) (parser is either called manually or intergrated into build pipeline, analyzing each new **_Target App_** version)

2. converts V8 coverage to Drill4J format
   - V8 coverage is sent from either
     - [Manual Testing Browser Extension](https://github.com/Drill4J/browser-extension)
     - [Auto Testing Browser Extension](https://github.com/Drill4J/auto-testing-browser-extension)

**_Target App_** - application that coverage is collected from
