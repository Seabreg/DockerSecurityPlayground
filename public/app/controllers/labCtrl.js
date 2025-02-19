var dsp_LabCtrl = function($scope, ServerResponse, $log, SocketService, dockerImagesService, dockerAPIService, $routeParams, $sce, SafeApply, $document, $uibModal, $location, $http, cfpLoadingBar, CurrentLabService, CleanerService, BreadCrumbs, AjaxService, $sce, WalkerService, Notification) {
  console.log("=== INIT LAB CONTROLLER ===");
  var userDir;
  var vm = this;
  var buttonDeleteProto = { action:openConfirmDelete, label:"Delete Lab" , class: "btn btn-danger"}
  var buttonImportProto = { action:importLab, label:"Import lab in your repo" , class: "btn btn-success"}
  var buttonGoProto = { action:goToUseNetwork, label : "Go", class: "btn btn-lg btn-blue"}
  var buttonGoDisabledProto = {action:goToUseNetwork, label: "Go", class: "btn btn-lg btn-blue disabled"}
  var buttonGoImage = { action:goToImages, label : "Images", class: "btn btn-lg btn-blue"}
  var buttonCreateProto = { action:goToCreateNetwork, label:"Create Docker Network" , class: "btn  btn-lg btn-success"}
  var onLoadCanvas;
  const warningMessageHeader = 'WARNING: ';
  const networkEmptyMessage =  'Network is empty! Have you drawn the containers?';

  $scope.registerCallback = function (cb) {
    onLoadCanvas = cb;
  }


  $scope.tinymceOptions = {
    onChange: function(e) {
      // put logic here for keypress and cut/paste changes
    },
    inline: false,
    plugins : 'advlist autolink link image lists charmap print preview',
    skin: 'lightgray',
    theme : 'modern'
  };

  vm.tinymceHtmlGoal=''
  vm.tinymceHtmlSolution=''
  //Button action create or go
  vm.buttonAction = buttonCreateProto
  //Button action import or delete
  vm.deleteImportButton = buttonDeleteProto
  vm.editVisible = false
  vm.repos,
    vm.lab = {} ,
    vm.labels=[],
    // Preview on the labs
    vm.previewSolution = '';
  vm.previewGoal = '';
  vm.isRunning;
  vm.exists = true;
  vm.isGoalEditShowed = true;
  vm.isSolutionEditShowed = true;
  vm.isSolutionPreviewOpen = false;
  vm.isGoalPreviewOpen= false;
  vm.noImages = false;
  vm.actionVisible = true,
    $scope.imageList = [];
  toEditName = ''	;
  $scope.init = function() {
    console.log("DSP_INIT");

    AjaxService.init()
      .dLabel
      .then(function(res) {
        vm.labelProjects = AjaxService.projectLabels.labels
      },
        function(err) {

        })

    var action = $routeParams.action ;
    if(action === 'new') {
      //		console.log("action new")
      $scope.lab_action_btn = { text : "Create", class:"btn btn-success" }
      $scope.lab_action = 'New lab '
      BreadCrumbs.breadCrumbs('/lab/new')
      $scope.lab_action_form = 'newlab'
    }
    else if (action === 'edit') {

      //BreadCrumbs.breadCrumbs('/lab/edit/$routeParams.namelab')
      $scope.lab_action_btn = { text : "Edit", class:"btn btn-warning" }
      $scope.lab_action = 'Edit '+ $routeParams.namelab;
      $scope.lab_action_form = 'editlab'
      //Update in edit breadcrumbs
      BreadCrumbs.breadCrumbs('/lab/edit', $routeParams.namelab);
      AjaxService.init()
        .dAll
        .then(function(res) {
          //User can only edit his labs (repo= username)
          vm.repos = WalkerService.repos
          userDir = AjaxService.config.name;
          var labname = $routeParams.namelab;
          var repo=  WalkerService.getUserRepo();

          if(repo) {
            var lab =  WalkerService.findLab(repo.name, $routeParams.nameLab);
            CurrentLabService.updateLab(lab);
            //User labs repos
            var labs = repo.labs
            if(labs) {
              var labToUse = _.findWhere(labs, {name:labname})
              if(labToUse) {
                toEditName = labToUse.name
                vm.lab.name= labToUse.name;
                vm.lab.description = labToUse.informations.description;
                //vm.lab.goal = CleanerService.parse(labToUse.informations.goal);
                vm.lab.goal = labToUse.informations.goal;
                vm.lab.solution = labToUse.informations.solution;
                vm.previewSolution = vm.lab.solution;
                vm.previewGoal = vm.lab.goal;
                vm.updatePreviewSolution();
                vm.updatePreviewGoal();
                vm.labels = labToUse.labels || []
              }
            }
          }
        },
          function(err) {

          })
    }
    //Use
    else if (action ==='use') {
      vm.buttonAction = '';
      BreadCrumbs.breadCrumbs('/lab/use', $routeParams.namelab);
      AjaxService.init()
        .dAll
        .then(function(res) {
          vm.repos = WalkerService.repos
          var labname = $routeParams.namelab
          var rname = $routeParams.repo;
          var username = AjaxService.config.name;
          CurrentLabService.updateLab(rname, labname);
          AjaxService.checkExistenceLab(rname, labname)
            .then(function successCallback(response) {
              var exists = response.data.data
              //If doesn't exists create new network button
              if(!exists)  {
                vm.buttonAction = buttonCreateProto
                vm.editVisible = false
                vm.exists = false;
              } else {
                dockerImagesService.areImagesInstalled(vm.repoName, vm.lab.name)
                  .then(function success(data) {
                    var areInstalled = data.data.data.areInstalled;
                    if (!areInstalled) {
                      console.log("NOT INSTALLED");
                      $scope.noImages = true;
                    } else {
                      dockerImagesService.get(function(images) {
                        $scope.imageList = images
                      });
                    }
                  }, function error(err) {
                    console.log(err);
                  });
              }
              //Else go button
              // else	{
              //   vm.buttonAction = buttonGoProto
              //   vm.editVisible = true
              // }
            },
              function errorCallback(response) {

              })
          //If username = repo name it's the user repo and it' possible to edit
          if(username === rname)
          {
            vm.actionVisible= true;
            vm.deleteImportButton = buttonDeleteProto;
          }
          //Don't edit if it's not a user repo
          else
          {
            vm.actionVisible = false;
            vm.deleteImportButton = buttonImportProto;
          }
          var repo = _.findWhere(vm.repos, {name:rname})
          var labs = repo.labs
          if(labs)
          {
            var labToUse = _.findWhere(labs, {name:labname})
            if(labToUse) {
              vm.isRunning = labToUse.state === 'RUNNING' ? true : false;
              // Repo name
              vm.repoName = rname
              vm.lab.name= labToUse.name;
              if (vm.isRunning) {
                _initNetworkList();
              }
              // Check the state
              if(labToUse.state === 'NO_NETWORK') {
                vm.buttonAction = buttonCreateProto
                vm.editVisible = false
              }
              // Else go button or images
              else {
                dockerAPIService.loadGeneralLab(vm.repoName, vm.lab.name, 0, function(data) {
                  $scope.labState = data.state === 'STOPPED' ? playProto : stopProto;
                  $scope.action = data.state === 'STOPPED' ? $scope.startLab : $scope.stopLab;
                  console.log("ONLOAD");
                  onLoadCanvas(data)
                  var yamlcode = angular.element('#code_yaml')

                  yamlcode.text(data.yamlfile)
                  Prism.highlightAll();
                  $scope.yamlfile = data.yamlfile;

                });
                vm.buttonAction = buttonGoProto
                vm.editVisible = true
              }

              if(labToUse.informations) {
                vm.lab.description = labToUse.informations.description;
                //vm.lab.goal = labToUse.informations.goal;
                vm.lab.goal = CleanerService.parse(labToUse.informations.goal);
                vm.lab.solution = CleanerService.parse(labToUse.informations.solution);
                vm.tinymceHtmlGoal= $sce.trustAsHtml(vm.lab.goal);
                vm.tinymceHtmlSolution = $sce.trustAsHtml(vm.lab.solution);

              }
              else {
                vm.lab.description = '';
                vm.lab.goal = '';
                vm.lab.solution = '';
                vm.tinymceHtmlGoal= '';
                vm.tinymceHtmlSolution = '';
              }
            }
            // dockerImagesService.getByLab(function(images) {
            //   if (images) {
            //     labsImages = images[repo.name].lab_images
            //     labImages = _.findWhere(labsImages, {nameLab:labToUse.name})
            //     var imagesToInstall = _.where(labImages.images, {contains:false});
            //       if(imagesToInstall.length > 0) {
            //         vm.noImages = true;
            //         vm.buttonAction = buttonGoDisabledProto;
            //       }
            //   }
            // });
            //Notification({message: "Some images are not installed. Go to the Image Manager"},'error');

            // dockerAPIService.getDSPImages()
            //.then(function successCallback(response) {
            //var images = response.data.data.images;
            //labsImages = images[repo.name].lab_images
            //labImages = _.findWhere(labsImages, {nameLab:labToUse.name})
            //var imagesToInstall = _.where(labImages.images, {contains:false});

            //if(imagesToInstall.length > 0) {
            //  vm.noImages = true;
            //  vm.buttonAction = buttonGoDisabledProto;
            //}
            //  //Notification({message: "Some images are not installed. Go to the Image Manager"},'error');
            //},
            //function errorCallback(error) {
            //  Notification({message:"Sorry,  error in loading docker images"}, 'error');
            //});
          }
        },
          function(err) {

          })

    }
  }
  $scope.goToContainer = function goToContainer(nameContainer, dc="true")  {
    console.log(nameContainer)
    console.log(dc)
    $http.post('/dsp_v1/dockershell', {
      namerepo : vm.repoName,
      namelab : vm.lab.name,
      dockername: nameContainer,
      dockercompose : dc
    })
      .then(
        function success(response) {
          console.log("SUCCESS");
          var windowReference = window.open();
          windowReference.location = "docker_socket.html";
          // window.open('docker_socket.html', '_blank');
        },
        function error(err) {
          // Lab running error
          Notification({message:"Server error: "+err.data.message}, 'error');
        });
  }

  $scope.copyFromContainer = function (nameContainer, dc="true") {
    var modalInstance = $uibModal.open({
      animation: true,
      component: 'copyFromContainerComponent',
      resolve: {
        lab: function () {
          return  {
            namerepo : vm.repoName,
            namelab : vm.lab.name,
            namecontainer: nameContainer,
            dockercompose : dc
          };
        }
      }
    });
    modalInstance.result.then(function () {
      console.log("responsmodalInstance")
    }, function () {
      $log.info('modal-component dismissed at: ' + new Date());
    });
  }
  $scope.copyInContainer = function (nameContainer, dc="true") {
    var modalInstance = $uibModal.open({
      animation: true,
      component: 'copyInContainerComponent',
      resolve: {
        lab: function () {
          return  {
            namerepo : vm.repoName,
            namelab : vm.lab.name,
            namecontainer: nameContainer,
            dockercompose : dc
          };
        }
      }
    });
    modalInstance.result.then(function () {
      console.log("responsmodalInstance")
    }, function () {
      $log.info('modal-component dismissed at: ' + new Date());
    });
  }

  vm.copyLab = function copyLab() {
    AjaxService.copyLab(vm.lab.name)
      .then(function successCallback(response) {
        Notification('Lab copied!', 'success');
        var newLabName = response.data.data;
        var urlToGo = '/lab/use/'+ vm.repoName+'/'+ newLabName;
        window.location.href= urlToGo;

      },
        function errorCallback(resp) {
          Notification('Server error:'+ resp.data.message, 'error');
        });

  }

  vm.goBack = function() {
    var urlToGo = '/lab/use/'+ AjaxService.config.name +'/'+ vm.lab.name;
    $location.url(urlToGo);
  }

  vm.labAction = function labAction() {
    var l = vm.lab ;
    //New lab
    if($scope.lab_action_form === 'newlab')
    {
      AjaxService.newLab(l, vm.labels)
        .then(function successCallback(response) {
          window.location.href='/labs';
          //    SafeApply.exec($scope, function() {
          //      WalkerService.repoNewLab({
          //        name:l.name,
          //        informations: {
          //          description: l.description,
          //          goal : l.goal,
          //          solution : l.solution
          //        },
          //        state: 'NO_NETWORK',
          //        labels:[]
          //    });
          //    vm.repos = WalkerService.repos;
          //  });
          //  $location.url('/labs')

        },

          function errorCallback(response) {
            Notification('Server error:'+ response.data.message, 'error');

          });

    }
    //Edit lab
    else if($scope.lab_action_form === 'editlab') {
      AjaxService.editLab(vm.lab, toEditName, vm.labels)
        .then(function successCallback(response) {

          //Update walk object
          WalkerService.repoChangeLab(toEditName, {
            //Lab object
            name: vm.lab.name,
            informations : {
              description : vm.lab.description || '',
              goal : vm.lab.goal || '',
              solution : vm.lab.solution || ''
            },
            labels:vm.labels
          })

          //Redirect to usage
          var urlRet = '/lab/use/'+AjaxService.config.name+"/"+vm.lab.name;
          $location.url(urlRet)
        },
          function errorCallback(response) {
            Notification('Server error:'+ response.data.message, 'error');
          })
    }
  }



  function goToCreateNetwork() {
    window.location.href = '/network/'+vm.lab.name+ "?create=1";
    // window.location.href='docker_graph_editor.html?nameRepo='+ vm.repoName +'&namelab='+vm.lab.name+'&action=new'
  }

  function goToImages() {
    $location.url("/images#"+vm.lab.name);
  }

  function goToUseNetwork() {

    window.location.href='/lab/use/'+vm.lab.name;

  }
  vm.goToEditNetwork = function goToEditNetwork() {
    $location.url('/lab/edit/'+vm.lab.name);
    // window.open('/lab/edit/'+vm.lab.name, '_blank');
  }
  vm.goToNetwork = function goToNetwork() {

    if (vm.isRunning)
      Notification('Cannot edit a running lab! Pls stop first', 'warning');
    else {
      // $location.url('/network/'+vm.lab.name);
      window.location.href = '/network/'+vm.lab.name;
      // window.location.href='docker_graph_editor.html?nameRepo='+ vm.repoName+ '&namelab=' + vm.lab.name + '&action=edit';
      // window.open('docker_graph_editor.html?nameRepo='+ vm.repoName+ '&namelab=' + vm.lab.name + '&action=edit', '_blank');
    }

  }

  function openConfirmDelete() {
    if (vm.isRunning)
      Notification('Cannot delete a running lab! Pls stop first', 'warning');
    else {
      var modalInstance = $uibModal.open({
        component: 'modalComponent',
        resolve: {
          lab: function () {
            return vm.lab;
          }
        }
      });
      //Cancel lab
      modalInstance.result.then(function () {
        var nameToDelete = vm.lab.name;
        AjaxService.deleteLab(nameToDelete)
          .then(function successCallback(response) {
            //Remove from ajaxRepos
            SafeApply.exec($scope, function() {
              WalkerService.repoRemoveLab(nameToDelete)
              vm.repos = WalkerService.repos;
            });
            //Return to labs
            $location.url('/labs')
          },function errorCallback(response) {});
      }, function() {});
    }
  }

  function importLab() {
    AjaxService.importLab(vm.repoName, vm.lab.name)
      .then(
        function successCallback(response) {
          Notification('Lab imported!', 'success');
          SafeApply.exec($scope, function() { WalkerService.repoNewLab(vm.lab); });
        },
        function errorCallback(resp) {
          Notification('Server error:'+ resp.data.message, 'error');
        }
      );


  }
  //Managment of tinyMCE area
  vm.updatePreviewSolution = function() {
    vm.previewSolution = $sce.trustAsHtml(vm.lab.solution);
  }
  vm.updatePreviewGoal = function() {
    vm.previewGoal = $sce.trustAsHtml(vm.lab.goal);
  }
  vm.updateHtml = function() {
    vm.tinymceHtml = $sce.trustAsHtml(vm.lab.solution);
  };

  $scope.notify=''
  $scope.yamlfile='';

  // ACTION FUNCTIONS
  //Proto actions
  const playProto = {  actionLabel:"Start lab",  actionClass:"glyphicon glyphicon-play", statusLabel: "Lab is inactive" , actionButton:"btn btn-success", state:'inactive' , statusClass:"alert alert-danger text-center"}
  const loadingProto = {  actionLabel:"Loading",  actionClass:"glyphicon glyphicon-refresh", statusLabel: "Loading..." , actionButton:"btn btn-warning", state:'loading' , statusClass:"alert alert-warning text-center"}
  const stopProto = { actionLabel:"Stop lab",  actionButton:"btn btn-danger", actionClass:"glyphicon glyphicon-stop", statusLabel: "Lab is active", state:'active', statusClass:"alert alert-success text-center"}
  function updateNotify(data) {
    if(!$scope.$$phase) {
      $scope.$apply(function() {
        $scope.notify+= data.message+"<br>";
      });
      //$digest or $apply
    }
    else $scope.notify += data.message;
  }

  function _initNetworkList() {
    console.log("INIT NETWORK LIST");
    dockerAPIService.getNetworkList(vm.repoName, vm.lab.name)
      .then(function successCallback(response) {
        $scope.networkList = response.data.data;
      }, function errorCallback(error) {
        Notification({message:"Server error: "+error}, 'error');
      });
  }
  //Start the lab
  $scope.startLab = function startLab()
  {
    //On start loading
    $scope.labState = loadingProto
    startLoad()
    $scope.action = $scope.loading

    //Send
    SocketService.manage(JSON.stringify({
      action : 'docker_up',
      params : {
        namerepo : vm.repoName,
        namelab : vm.lab.name
      }
    }), function(event) {
      var data = JSON.parse(event.data);
      if(data.status === 'success')  {
        //Set state on stop
        $scope.labState = stopProto
        $scope.action = $scope.stopLab
        _initNetworkList();
        //End load action
        completeLoad()
      }
      else if(data.status === 'error') {
        Notification('Some error in docker-compose up command', 'error');
        $scope.responseError = $scope.responseErrorHeader + data.message;
        $scope.labState = playProto
        $scope.action = $scope.startLab
      }
      else updateNotify(data);
    });
  } //End startlab
  $scope.clearLogs = function() {
    $scope.notify = "";
    $scope.responseError = "";
  }
  //Stop the lab
  $scope.stopLab = function stopLab() {
    //Temp state of loading
    $scope.labState = loadingProto
    startLoad()
    $scope.action = $scope.loading
    //Open socket
    //	var url = '/dsp_v1/docker_compose/'+$scope.nameRepo+"/"+$scope.labName
    //Send compose up
    SocketService.manage(JSON.stringify({
      action : 'docker_down',
      params : {
        namerepo : vm.repoName,
        namelab : vm.lab.name
      }
    }),
      function(event) {
        var data = JSON.parse(event.data);
        if(data.status === 'success')  {
          dockerAPIService.detachAllServices();
          //Complete spinner
          completeLoad()
          //labState to play proto
          $scope.labState = playProto
          $scope.action = $scope.startLab
          _initNetworkList()
        }
        else if(data.status === 'error') {
          Notification('Some error in docker-compose down command', 'error');
          //	$scope.labState = playProto
          //	$scope.action = $scope.startLab
        }
        else updateNotify(data);
      });
  }

  //Nothing to do
  $scope.loading = function loading() {}


  function startLoad() {
    cfpLoadingBar.start();
  };

  function completeLoad() {
    cfpLoadingBar.complete();
  }

}

