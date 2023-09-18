/*
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using Microsoft.AspNetCore.Mvc;

using WebRestAPI.Models;

namespace WebRestAPI.Controllers
{
    // Very simple persisted multi-threaded singleton cache implementation...
    
    public static class ServiceCache
    {
        private static ConcurrentStack<string> cache;

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
        private static ConcurrentDictionary<string, ComputeInstance> instances;

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
    public class TestController : ControllerBase
    {
        // GET: api/test/version
        [HttpGet("version/")]
        public string GetVersion()
        {
            return "This is test version 1.1";
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
