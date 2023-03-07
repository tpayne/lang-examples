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
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Json;
using System.IO;
using System.Net;

using WebRestAPI.Models;
using WebRestAPI.Implementors;

namespace WebRestAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ActionsController : ControllerBase
    {
        //
        // Private implementation classes
        //
        private GHWorkflowApiImpl impl = new GHWorkflowApiImpl();


        //
        // Private interface functions
        //

        private async Task<Stream> ListActionsCmd(string owner, string repoName, string creds)
        {
            return await impl.ListActionsImpl(owner, repoName, creds);
        }

        private async Task<HttpResponseMessage> RunWorkflowCmd(string owner, string repoName,
                                                   long workflowId,
                                                   RunWorkflowsCmdParams cmdParams,
                                                   string creds)
        {
            return await impl.RunWorkflowImpl(owner, repoName, workflowId, cmdParams, creds);
        }

        private async Task<Stream> ListJobsCmd(string owner,
                                               string repoName,
                                               string creds,
                                               DateTime runDate)
        {
            return await impl.ListJobsImpl(owner, repoName, creds, runDate);
        }

        private async Task<Stream> GetJobRunCmd(string owner, string repoName,
                                          string creds, long jobId)
        {
            return await impl.GetJobRunImpl(owner, repoName, creds, jobId);
        }

        private async Task<Stream> GetJobCmd(string owner, string repoName,
                                          string creds, long jobId)
        {
            return await impl.GetJobImpl(owner, repoName, creds, jobId);
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
            return "This is workflow version 1.1";
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
                Stream actionsList = await ListActionsCmd(owner, repoName,
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
