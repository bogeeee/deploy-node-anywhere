# Deploy node anywhere

**!!!!!!!!!!!!!Örly Konzept, does not work yet!!!!!!!!!!!!!!**

Just one command that deploys your Node.js server app either to a...
1) **bare metal host with Node.js** or 
2) **host with docker** or 
3) public or paid **deploy-node-anywhere hosting provider** (which sets up a domain name an SSL for you instantly) 

````bash
npx deploy-node-anywere
````

This command will analyze your package.json and **will show you a copy&pasteable autopuller shell command** (or a link) for each of the above 3 variants and listen for connections from them. 


- **No docker required on your dev machine**. _Still creates a `Dockerfile` and emulates docker functionality, so you can switch to a full docker build process any time_.
- **No docker registry required**
- **No direct connection to the target host required**. _A public rendezvous server is used to make the connection. It will see only encrypted traffic._ 
- **Watches also for updates automatically**
- **Allows cross plattform deployment.** _I.e. from a windows dev machine to a Raspberry pi, which is not possible with normal docker._




# Usage
- _Make sure you **run your "clean" and "build"** npm scripts before deploying_ 
- **provide a "start" npm script** to be run by the target.  
- **run `npx deploy-node-anywere`**. _Either manually or add it to devDependencies and run it through a script_.  
On the first run, a `Dockerfile` with reasonable settings and a `.dockerignore` file will be created and this your point for all configuration later.  
The autopuller and your dev machine will establish a connection (in all variants) and the `COPY` commands inside the Dockerfile will tell which files get copied and the `CMD` commands will tell, what installation steps will be run on the target. 
By default, this copies your files to `[target]/app` and runs a `npm install` to download the `node_modules` there. See the `Dockerfile` for more detais.   
To ensure encrypted communication and authorize your dev machine to push updates, a source and target key key-pair will be generated and the seed key is stored under `.deploy-node-anywhere`.

**Important: All files/data that were created on the target during production run will be erased on a re-deployment 
unless you specify a volume** by `VOLUME /app/myData` inside the Dockerfile **and** also, for the "host with docker" variant, you must use `-v myNamedVolume:/app/myData` on the docker command line.
 
<details>
    <summary>If everything works fine, the console output should look like this</summary>
````bash
TODO
````
</details>


If you like this simple-to-use style of a library and are looking for a good and secure communication library, have a look at my other flagship project: [Restfuncs](https://github.com/bogeeee/restfuncs)

# Alternatives
<details>
  <summary>Deploy with PM2</summary> 

[PM2](https://pm2.keymetrics.io) allows to deploy to a cluster of **multiple** bare metal or docker hosts.
  It has advanced logging and metrics monitoring capabilites (ram/cpu/disk). Also it has an integrated load balancer. Requires more configuration and uses a git server as the central "registry" (need to configure access to it).
</details>

<details>
<summary>Deploy with Docker + Watchtower</summary>

Here are the steps to use [docker](https://www.docker.com/) + [Watchtower](https://github.com/containrrr/watchtower), which watches the registry and pulls new image versions automatically, like the autopuller.  

1) **Crate a dockerfile**  
   You may run `npm deploy-node-anywhere` to create a `Dockerfile` with a reasonable starter configuration for a Node app
   
2) **Build docker image**
````bash
docker build -t mydockerimage .
````
3) **Create a hub.docker.com account   
or set up your own docker registry**  

To set up your own docker registry, on some machine, do:
````bash
mkdir /root/dockerRegistryConfig
openssl req -x509 -nodes -newkey rsa:4096  -keyout /root/dockerRegistryConfig/pub-secret-key.pem -sha256 -days 70000 -out /root/dockerRegistryConfig/public.pem
docker run -d -p 5000:5000 --restart=unless-stopped --name registry -v /root/dockerRegistryConfig:/cfg -v dockerRegistry:/var/lib/registry -e "REGISTRY_AUTH=htpasswd" -e "REGISTRY_AUTH_HTPASSWD_REALM=Registry Realm" -e "REGISTRY_AUTH_HTPASSWD_PATH=/cfg/htpasswd" -e "REGISTRY_AUTH_HTPASSWD_PATH=/cfg/htpasswd" -e "REGISTRY_HTTP_TLS_CERTIFICATE=/cfg/public.pem" -e "REGISTRY_HTTP_TLS_KEY=/cfg/pub-secret-key.pem" registry:2
# Add user/pasword:
htpasswd -Bc /root/dockerRegistryConfig/htpasswd user
   
````
And on your dev machine:
````bash
echo '{ "insecure-registries" : [ "your_registry_host.xy:5000" ] }' > /etc/docker/daemon.json && systemctl restart docker
````

4) **Log in to the registry**
````bash
docker login -u docker docker_registry_host.xy:5000
````

5) **Publish to the registry**
````bash
docker tag your-project-name docker_registry_host.xy:5000/your-project-name && docker push docker_registry_host.xy:5000/your-project-name
````
6) **Pull and run docker image on target machine**
````bash
   docker run --name your-project-name -d --restart=unless-stopped -p host_port:port_inside_image -v my_volume_name:/app/db [...volume mappings and env variables] docker_registry_host.xy:5000/your-project-name 
````
7) **Run watchtower on target machine to watch for new versions**
````bash
docker run -d --restart=unless-stopped --name watchtower -v /var/run/docker.sock:/var/run/docker.sock -v /root/.docker/config.json:/config.json:ro containrrr/watchtower -i 10 --cleanup --log-level warn --include-stopped --include-restarting
````
</summary>