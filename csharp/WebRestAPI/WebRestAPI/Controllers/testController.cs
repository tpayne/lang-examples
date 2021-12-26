using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

using WebRestAPI.Models;

namespace WebRestAPI.Controllers
{
    // Very simple persisted multi-threaded singleton cache implementation...
    public static class ServiceCache
    {
        public static ConcurrentStack<string> cache;

        private static object cacheLock = new object();
        public static ConcurrentStack<string> AppCache
        {
            get
            {
                lock (cacheLock)
                {
                    if (cache == null)
                    {
                        cache = new ConcurrentStack<string>();
                    }
                    return cache;
                }
            }
        }
    }

    public static class ServiceinstanceCache
    {
        public static ConcurrentDictionary<string, ComputeInstance> instances;

        private static object cacheLock = new object();
        public static ConcurrentDictionary<string, ComputeInstance> InstanceCache
        {
            get
            {
                lock (cacheLock)
                {
                    if (instances == null)
                    {
                        instances = new ConcurrentDictionary<string, ComputeInstance>();
                    }
                    return instances;
                }
            }
        }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class testController : ControllerBase
    {
        // GET: api/test/version
        [HttpGet("version/")]
        public string GetVersion()
        {
            return "This is test version 1.0";
        }

        // GET: api/test/list
        // api/test/list?projectId=<string>&zone=<string>
        [HttpGet("list/")]
        public string GetProjectZone(string projectId, string zone)
        {
            if (projectId != null)
            {
                ServiceCache.AppCache.Push(projectId);
                return "This is project "
                    + projectId
                    + " in zone "
                    + ((zone != null) ? zone : "null");
            }
            else
            {
                string str = "These are the projects -> ";
                foreach (String f in ServiceCache.AppCache)
                {
                    str += f;
                    str += ",";
                }
                return str;
            }
        }

        // GET: api/test/compute
        // api/test/list?projectId=<string>&zone=<string>
        [HttpGet("compute/")]
        public string ListComputers()
        {
            int count = 0;
            string str = "These are the computers -> ";
            foreach (var f in ServiceinstanceCache.InstanceCache)
            {
                if (count > 0)
                    str += ",";
                ComputeInstance x = f.Value;
                str += "['" + x.instanceName + "," + x.zoneId + "," + x.imageName;
                str += "," + x.machineType + "," + x.inetInterface + "']";
                count++;
            }
            return str;
        }

        // GET: api/test
        [HttpGet]
        public IEnumerable<string> Get()
        {
            return new string[] { "value1", "value2" };
        }

        // GET: api/test/5
        [HttpGet("{id}", Name = "Get")]
        public string Get(int id)
        {
            return "value";
        }

        // POST: api/test
        [HttpPost("compute/")]
        public void PostCompute([FromBody] ComputeInstance cs)
        {
            ServiceinstanceCache.InstanceCache.TryAdd(cs.instanceName, cs);
            return;
        }

        // POST: api/test
        [HttpPost]
        public void Post([FromBody] string value) { }

        // PUT: api/test/5
        [HttpPut("{id}")]
        public void Put(int id, [FromBody] string value) { }

        // DELETE: api/test/5
        [HttpDelete("{id}")]
        public void Delete(int id) { }
    }
}
