using System;
namespace WebRestAPI.Models
{
    public class ComputeInstance
    {
        public string instanceName { get; set; }
        public string zoneId { get; set; }
        public string imageName { get; set; }
        public string inetInterface { get; set; }
        public string machineType { get; set; }
    }
}
