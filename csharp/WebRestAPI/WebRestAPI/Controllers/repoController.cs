using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Collections.Generic;
using System.Text.Json;
using System.IO;
using Newtonsoft.Json;

using WebRestAPI.Models;

namespace WebRestAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class repoController : ControllerBase
    {
        private static readonly HttpClient client = new HttpClient();

        private async Task<Stream> ListRepos()
        {
            client.DefaultRequestHeaders.Accept.Clear();
            client.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/vnd.github.v3+json")
            );
            client.DefaultRequestHeaders.Add("User-Agent", ".NET Foundation Repository Reporter");

            var streamTask = client.GetStreamAsync("https://api.github.com/users/tpayne/repos");

            Stream msg = await streamTask;
            return msg;
        }

        // GET: api/repo/version
        [HttpGet("version/")]
        public string GetVersion()
        {
            return "This is repo version 1.0";
        }

        // GET: api/repo/dump
        [HttpGet("dump/")]
        public async Task<List<GithubRepos>> GetRepoDump()
        {
            // Dump the repo as a list of objects and return as JSON
            Stream repoList = await ListRepos();
            var repositories = await System.Text.Json.JsonSerializer.DeserializeAsync<
                List<GithubRepos>>(repoList);
            return repositories;
        }

        // GET: api/repo/list
        [HttpGet("list/")]
        public async Task<string> GetRepoList()
        {
            string str = "No repos";
            int count = 0;
            Stream repoList = await ListRepos();
            var repositories = await System.Text.Json.JsonSerializer.DeserializeAsync<
                List<GithubRepos>
            >(repoList);

            foreach (var repo in repositories)
            {
                if (count > 0)
                    str += ",";
                else
                    str = "Git repos detected -> ";
                str += "['" + repo.repoName + "," + repo.repoUrl + "," + repo.lastUpdate + "']";
                count++;
            }

            return str;
        }

        // GET: api/repo/repostring
        [HttpGet("repostring/")]
        public async Task<string> GetRepoListStr()
        {
            Stream repoList = await ListRepos();
            StreamReader reader = new StreamReader(repoList);
            string text = reader.ReadToEnd();
            dynamic parsedJson = JsonConvert.DeserializeObject(text);
            return JsonConvert.SerializeObject(parsedJson, Formatting.Indented);
        }
    }
}
