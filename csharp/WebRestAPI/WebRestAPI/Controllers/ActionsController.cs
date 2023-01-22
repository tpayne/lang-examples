using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Collections.Generic;
using System.Text.Json;
using System.Text;
using System.IO;
using Newtonsoft.Json;
using System.Net;
using System.Web;

using WebRestAPI.Models;

namespace WebRestAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ActionsController : ControllerBase
    {
        //
        // Private implementation classes
        //
        private async Task<Stream> GetJobImpl(string owner, string repoName,
                                          string creds, long jobId)
        {
            try
            {
                HttpClient client = Utils.GetHttpClient(creds);

                string uri = "https://api.github.com/repos/" + owner + "/" + repoName +
                    "/actions/runs/" + jobId;

                var streamTask = client.GetStreamAsync(uri);
                Stream msg = await streamTask;

                return msg;
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: {0}", e.Message + "\n" + e.StackTrace);
                return null;
            }
        }

        private async Task<Stream> GetJobRunImpl(string owner, string repoName,
                                          string creds, long jobId)
        {
            try
            {
                HttpClient client = Utils.GetHttpClient(creds);

                string uri = "https://api.github.com/repos/" + owner + "/" + repoName +
                    "/actions/runs/" + jobId + "/jobs";

                var streamTask = client.GetStreamAsync(uri);
                Stream msg = await streamTask;

                return msg;
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: {0}", e.Message + "\n" + e.StackTrace);
                return null;
            }
        }

        private async Task<Stream> ListActions(string owner, string repoName, string creds)
        {
            try
            {
                HttpClient client = Utils.GetHttpClient(creds);

                string uri = "https://api.github.com/repos/" + owner + "/" + repoName + "/actions/workflows";
                var streamTask = client.GetStreamAsync(uri);
                Stream msg = await streamTask;

                return msg;
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: {0}", e.Message + "\n" + e.StackTrace);
                return null;
            }
        }

        private async Task<Stream> ListJobsImpl(string owner, string repoName,
                                            string creds, DateTime dateTime)
        {
            try
            {
                HttpClient client = Utils.GetHttpClient(creds);
                string iso;

                if (dateTime == DateTime.MinValue)
                {
                    iso = DateTime.UtcNow.ToString("s");
                }
                else
                {
                    iso = dateTime.ToString("s");
                }

                string uri = "https://api.github.com/repos/" + owner + "/" + repoName +
                    "/actions/runs?created=%3E" + iso;

                var streamTask = client.GetStreamAsync(uri);
                Stream msg = await streamTask;

                return msg;
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: {0}", e.Message + "\n" + e.StackTrace);
                return null;
            }
        }

        private async Task<HttpResponseMessage> RunWorkflowImpl(string owner, string repoName,
                                                   long workflowId,
                                                   RunWorkflowsCmdParams cmdParams,
                                                   string creds)
        {
            try
            {
                HttpClient client = Utils.GetHttpClient(creds);

                string uri = "https://api.github.com/repos/" + owner + "/" +
                                repoName + "/actions/workflows/" + workflowId.ToString() +
                                "/dispatches";

                var response = client.PostAsJsonAsync<RunWorkflowsCmdParams>(uri, cmdParams);
                HttpResponseMessage msg = await response;
                var reason = msg.Content.ReadAsStringAsync().Result;
                var resp = new HttpResponseMessage(msg.StatusCode)
                {
                    Content = msg.Content,
                    ReasonPhrase = reason
                };
                return resp;
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: {0}", e.Message + "\n" + e.StackTrace);
                var resp = new HttpResponseMessage(HttpStatusCode.InternalServerError)
                {
                    Content = new StringContent("Server generated an exception"),
                    ReasonPhrase = "Server generated an exception"
                };
                return resp;
            }
        }

        //
        // Public interface functions
        //

        public async Task<HttpResponseMessage> RunWorkflowCmd(string owner, string repoName,
                                                   long workflowId,
                                                   RunWorkflowsCmdParams cmdParams,
                                                   string creds)
        {
            return await RunWorkflowImpl(owner, repoName, workflowId, cmdParams, creds);
        }

        public async Task<Stream> ListJobsCmd(string owner,
                                               string repoName,
                                               string creds,
                                               DateTime runDate)
        {
            return await ListJobsImpl(owner, repoName, creds, runDate);
        }

        public async Task<Stream> GetJobRunCmd(string owner, string repoName,
                                          string creds, long jobId)
        {
            return await GetJobRunImpl(owner, repoName, creds, jobId);
        }

        public async Task<Stream> GetJobCmd(string owner, string repoName,
                                          string creds, long jobId)
        {
            return await GetJobImpl(owner, repoName, creds, jobId);
        }

        //
        // API endpoint interfaces
        ///

        // POST: api/actions/submit/{owner}/{repoName}/{workflow_id}/execute
        [HttpPost("{owner}/{repoName}/{workflowId:long}/execute")]
        public async Task<dynamic> PostStartWorkflow(string owner, string repoName,
                                                   long workflowId,
                                                   [FromBody] RunWorkflowsCmdParams cmdParams)
        {
            try
            {
                string creds = Utils.GetCreds(Request);
                HttpResponseMessage resp = await RunWorkflowCmd(owner, repoName,
                                                             workflowId,
                                                             cmdParams,
                                                             creds);
                if (resp.StatusCode == HttpStatusCode.OK ||
                    resp.StatusCode == HttpStatusCode.NoContent)
                {
                    return resp.StatusCode;
                }
                return resp.ReasonPhrase;
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: {0}", e.Message + "\n" + e.StackTrace);
                var resp = new HttpResponseMessage(HttpStatusCode.InternalServerError)
                {
                    Content = new StringContent("Server generated an exception"),
                    ReasonPhrase = "Server generated an exception"
                };
                return resp;
            }
        }

        // GET: api/workflow/version
        [HttpGet("version/")]
        public string GetVersion()
        {
            return "This is workflow version 1.0";
        }

        // GET: api/actions/{owner}/{repo}/jobs/list
        [HttpGet("{owner}/{repoName}/jobs/list")]
        public async Task<dynamic> GetJobs(string owner, string repoName,
                                                      [FromQuery] DateTime runDate,
                                                      bool format = true)
        {
            try
            {
                string creds = Utils.GetCreds(Request);
                Stream jobsList = await ListJobsCmd(owner, repoName,
                                                 creds,
                                                 runDate);
                if (format)
                {
                    return Utils.FormatJson(jobsList);
                }
                var jobs = await System.Text.Json.JsonSerializer.DeserializeAsync<GithubWorkflowRuns>(jobsList);
                return jobs;
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: {0}", e.Message + "\n" + e.StackTrace);
                return null;
            }
        }

        // GET: api/actions/{owner}/{repo}/jobs/{jobId}/steps
        [HttpGet("{owner}/{repoName}/jobs/{jobId:long}/steps")]
        public async Task<dynamic> GetJobRun(string owner, string repoName,
                                          long jobId, bool format = true)
        {
            try
            {
                Stream job = await GetJobRunCmd(owner, repoName,
                                          Utils.GetCreds(Request), jobId);
                if (format)
                {
                    return Utils.FormatJson(job);
                }
                var jobDetails = await System.Text.Json.JsonSerializer.DeserializeAsync<GithubJobs>(job);
                return jobDetails;
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: {0}", e.Message + "\n" + e.StackTrace);
                return null;
            }
        }

        // GET: api/actions/{owner}/{repo}/jobs/{jobId}
        [HttpGet("{owner}/{repoName}/jobs/{jobId:long}")]
        public async Task<dynamic> GetJob(string owner, string repoName,
                                          long jobId, bool format = true)
        {
            try
            {
                Stream job = await GetJobCmd(owner, repoName,
                                          Utils.GetCreds(Request), jobId);
                if (format)
                {
                    return Utils.FormatJson(job);
                }
                var jobDetails = await System.Text.Json.JsonSerializer.DeserializeAsync<WorkflowRun>(job);
                return jobDetails;
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: {0}", e.Message + "\n" + e.StackTrace);
                return null;
            }
        }

        // GET: api/actions/{owner}/{repo}/list
        [HttpGet("{owner}/{repoName}/list")]
        public async Task<dynamic> GetActions(string owner, string repoName,
                                              bool format = true)
        {
            try
            {
                Stream actionsList = await ListActions(owner, repoName,
                                                       Utils.GetCreds(Request));
                if (format)
                {
                    return Utils.FormatJson(actionsList);
                }
                var actions = await System.Text.Json.JsonSerializer.DeserializeAsync<GitHubActions>(actionsList);
                return actions;
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: {0}", e.Message + "\n" + e.StackTrace);
                return null;
            }
        }

        // GET: api/actions/
        [HttpGet("")]
        public HttpResponseMessage UnsupportedMethod()
        {
            var resp = new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent("Unsupported method"),
                ReasonPhrase = "Unsupported method"
            };
            return resp;
        }
    }
}
