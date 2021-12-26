using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;

using WebRestAPI.Models;

namespace WebRestAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class repoController : ControllerBase
    {
        private static readonly HttpClient client = new HttpClient();

        private static async Task<string> ListRepos()
        {
            client.DefaultRequestHeaders.Accept.Clear();
            client.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/vnd.github.v3+json"));
            client.DefaultRequestHeaders.Add("User-Agent", ".NET Foundation Repository Reporter");

            var stringTask = client.GetStringAsync("https://api.github.com/users/tpayne/repos");

            string msg = await stringTask;
            return msg;
        }

        // GET: api/repo/version
        [HttpGet("version/")]
        public string GetVersion()
        {
            return "This is repo version 1.0";
        }

        // GET: api/repo/version
        [HttpGet("list/")]
        public async Task<string> GetRepoList()
        {
            string repoList = await ListRepos();
            return repoList;
        }

    }
}
