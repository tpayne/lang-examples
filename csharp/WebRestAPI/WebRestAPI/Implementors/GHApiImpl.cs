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
using System.Linq;
using System.Threading.Tasks;
using System.Net.Http;
using System.Net.Http.Json;
using System.IO;
using System.Net;

using WebRestAPI.Models;

namespace WebRestAPI.Implementors
{
    public class GHApiImpl
    {
        public async Task<Stream> GetJobImpl(string owner, string repoName,
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

        public async Task<Stream> GetJobRunImpl(string owner, string repoName,
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

        public async Task<Stream> ListActionsImpl(string owner, string repoName, string creds)
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

        public async Task<Stream> ListJobsImpl(string owner, string repoName,
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

        public async Task<HttpResponseMessage> RunWorkflowImpl(string owner, string repoName,
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
    }
}
