using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

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

    [Route("api/[controller]")]
    [ApiController]
    public class testController : ControllerBase
    {
        // GET: api/test/version
        [HttpGet("version/")]
        public string GetVersion()
        {
            return "This is version 1.0";
        }

        // GET: api/test/list
        // api/test/list?projectId=<string>&zone=<string>
        [HttpGet("list/")]
        public string GetProjectZone(string projectId, string zone)
        {
            if (projectId != null)
            {
                ServiceCache.AppCache.Push(projectId);
                return "This is project " + projectId + " in zone " + ((zone != null) ? zone : "null");
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
        [HttpPost]
        public void Post([FromBody] string value)
        {
        }

        // PUT: api/test/5
        [HttpPut("{id}")]
        public void Put(int id, [FromBody] string value)
        {
        }

        // DELETE: api/test/5
        [HttpDelete("{id}")]
        public void Delete(int id)
        {
        }
    }
}
