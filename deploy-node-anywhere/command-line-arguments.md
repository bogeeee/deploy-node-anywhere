## --sourceDir
The source directory where also the `package.json` `Dockerfile` will be taken from (or created), as described in the [readme](readme.md#usage)
## --dockerfile
Path to the `Dockerfile`. Default: `./Dockerfile`. Relative to --sourceDir.
## --allow-run-commands
Allow RUN commands inside the Dockerfile.  
**Warning:** Deploy-node-anywhere can't clean up changes which you made to the system by these commands on a re-deployment. So consider to re-deploy the whole autopuller container then.
## --repository
Default: https://deploy-node-anywere.io

